<template>
  <main class="container">
    <div class="controls">
      <div class="textField">
        <label for="folderName">Название папки: </label>
        <input type="text" id="folderName" v-model="folderName" />
      </div>
      <div class="textField">
        <label for="photoNote">Заметка для сбора картинок: </label>
        <input type="text" id="photoNote" v-model="settingsStore.photoNote" />
      </div>
      <div class="textField">
        <label for="defaultNotes">Дефолтные заметки: </label>
        <input type="text" id="defaultNotes" v-model="settingsStore.defaultNotes" />
      </div>
      <Notes />
      <textarea
        class="linksList"
        @input="
          (e) => {
            isSettingsSaving = true
            settingsStore.inputText = e.target.value
          }
        "
        :key="textareaKey"
        >{{ settingsStore.inputText }}</textarea
      >
      <div class="fetchButton" type="button" @click="formatPosts">Отформатировать посты</div>
      <div class="fetchButton" type="button" @click="fetchPosts">Собрать посты</div>
    </div>
    <div class="result" v-if="failedPostsText || failedPosts.length > 0">
      <div v-for="{ fullLink, notes } in failedPosts">{{ fullLink }} {{ notes?.join(', ') }}</div>
      <div v-if="failedPosts.length === 0">{{ failedPostsText }}</div>
    </div>
    <div class="savingStatus" :class="{ active: isSettingsSaving }">
      <p>Идёт сохранение текста</p>
      <p>Не закрывай сервер</p>
    </div>
    <ErrorPopup />
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'

import { useSettingsStore } from '@/stores/settings.js'

import Notes from '@/components/Notes.vue'
import ErrorPopup from '@/components/ErrorPopup.vue'

const settingsStore = useSettingsStore()

const notesRegExp = /([а-яА-ЯёЁ]+)/g
const photosPositionRegExp = /\b\d\b/g
const linkRegExp = /(((t|telegram)\.me)|(tgstat\.ru\/channel))\/@?(?<link>[\/a-zA-Z0-9_\-\+]+)\/?/

const failedPosts = ref([])
const failedPostsText = ref('')
const folderName = ref(new Date().toLocaleDateString('ru'))
const textareaKey = ref(1)
const defaultNotes = computed(() => settingsStore.defaultNotes.match(notesRegExp))
const isSettingsSaving = ref(false)

function formatPosts() {
  const links = {}
  const processedLinks = []
  const duplicateLinks = []
  const rows = settingsStore.inputText.split('\n')
  let lastNotes = null
  let lastPhotoPositions = null

  for (const row of rows) {
    if (row.slice(0, 2) === '//') continue

    const { link } = row.match(linkRegExp)?.groups ?? { link: false }
    const rowNotes = row.match(notesRegExp)
    const rowPhotoPositions = row.match(photosPositionRegExp)

    if (link) {
      if (!links[link] && !processedLinks.includes(link)) {
        links[link] = `https://t.me/${link} ${(rowNotes ?? lastNotes ?? defaultNotes.value ?? []).join(', ')} ${(
          rowPhotoPositions ??
          lastPhotoPositions ??
          []
        ).join(' ')}`
        processedLinks.push(link)
      } else {
        if (links[link]) {
          duplicateLinks.push(links[link])
          delete links[link]
        }

        duplicateLinks.push(
          `https://t.me/${link} ${(rowNotes ?? lastNotes ?? defaultNotes.value ?? []).join(', ')} ${(
            rowPhotoPositions ??
            lastPhotoPositions ??
            []
          ).join(' ')}`
        )
      }

      lastNotes = null
      lastPhotoPositions = null
    }

    if (!link && !row.includes(':') && rowNotes) {
      lastNotes = rowNotes
    }

    if (!link && !row.includes(':') && rowPhotoPositions) {
      lastPhotoPositions = rowPhotoPositions
    }
  }

  settingsStore.inputText = `${Object.values(links).join('\n')}\n\n${duplicateLinks.join('\n')}`
  textareaKey.value++
}

async function fetchPosts() {
  const linksObject = {}
  const rows = settingsStore.inputText.split('\n')

  for (const row of rows) {
    failedPosts.value = []
    failedPostsText.value = 'Загрузка...'

    const { link } = row.match(linkRegExp)?.groups ?? { link: false }
    let fetchPhotos = false
    let photosPositions = []

    if (link) {
      const [channelName, postId] = link.split('/')
      const rawNotes = row?.match(notesRegExp)
      const indexOfPhotoNote = rawNotes?.indexOf(settingsStore.photoNote) ?? -1

      if (indexOfPhotoNote !== -1) {
        rawNotes.splice(indexOfPhotoNote, 1)
        fetchPhotos = true
        photosPositions = row.match(photosPositionRegExp) ?? []
      }

      const notes =
        rawNotes?.map((note) => {
          const { after } = settingsStore.notes.find(({ before }) => note === before) ?? {}

          return after ?? note
        }) ?? []

      linksObject[link] = {
        fullLink: `https://t.me/${link}`,
        channelName,
        postId,
        rawNotes: [...(row?.match(notesRegExp) ?? []), ...(photosPositions ?? [])],
        notes,
        fetchPhotos,
        photosPositions
      }
    }
  }

  const response = await fetch('http://localhost:8083/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      linksList: Object.values(linksObject),
      folderName: folderName.value
    })
  })

  if (response.ok) {
    const rawFailedPosts = await response.json()
    failedPosts.value = rawFailedPosts
    failedPostsText.value = 'Все посты собраны успешно'
  }
}

function debounce(fn, timeout) {
  let lastCall = false
  let lastCallTimer = false

  return function (...args) {
    let previousCall = lastCall
    lastCall = Date.now()

    if (previousCall && lastCall - previousCall <= timeout) {
      clearTimeout(lastCallTimer)
    }

    lastCallTimer = setTimeout(() => fn(...args), timeout)
  }
}

function saveSettings(mutation, { inputText, notes, photoNote, defaultNotes }) {
  fetch('http://localhost:8083/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputText,
      notes,
      photoNote,
      defaultNotes
    })
  })
  isSettingsSaving.value = false
}

settingsStore.$subscribe(debounce(saveSettings, 3000))
</script>

<style scoped>
.container {
  width: 90%;
  margin: 0 auto;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.controls {
  width: 100%;
  max-width: 500px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.textField {
  margin-bottom: 8px;
}

.linksList {
  width: 100%;
  height: 450px;
  margin-bottom: 8px;
  resize: vertical;
  font-size: 12px;
}

.fetchButton {
  margin-bottom: 4px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  border-radius: 4px;
  cursor: pointer;
  background: #aca7a7;
  font-weight: bold;
  user-select: none;
}

.fetchButton:hover {
  background: rgb(222, 216, 216);
}

.result {
  width: 100%;
  padding: 24px;
  background: rgb(222, 216, 216);
  border-radius: 24px;
  white-space: pre-wrap;
}

.savingStatus {
  padding: 20px 40px;
  border-radius: 16px;
  border: 2px solid #7f8858;
  position: fixed;
  top: 50%;
  right: 20px;
  background: #eeffaa;
  transition: 0.5s opacity ease;
  opacity: 0;
  transform: translateY(-50%);
}

.savingStatus p {
  font-weight: bold;
}

.savingStatus.active {
  opacity: 1;
}
</style>
