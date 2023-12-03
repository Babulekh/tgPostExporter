<template>
  <details class="notesContainer">
    <summary>Показать/Скрыть заметки</summary>
    <div class="notes">
      <div class="note" v-for="(note, index) in settingsStore.notes" :key="note">
        <input class="noteInput before" type="text" v-model="settingsStore.notes[index].before" />
        <input class="noteInput after" type="text" v-model="settingsStore.notes[index].after" />
        <div class="deleteNote" @click="deleteNote(index)">
          <img src="@/assets/cross.svg" alt="Удалить заметку" />
        </div>
      </div>
      <div class="addNote" @click="addNote">
        <img src="@/assets/plus.svg" alt="Добавить заметку" />
      </div>
    </div>
  </details>
</template>

<script setup>
import { useSettingsStore } from '@/stores/settings.js'

const settingsStore = useSettingsStore()

const addNote = () => settingsStore.notes.push({ before: '', after: '' })
const deleteNote = (index) => settingsStore.notes.splice(index, 1)
</script>

<style>
.notesContainer {
  width: 100%;
  margin-bottom: 8px;
}

.notesContainer summary {
  cursor: pointer;
  user-select: none;
}

.notes {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.note {
  margin-bottom: 4px;
  display: flex;
}

.noteInput {
  margin-right: 4px;
}

.before {
  width: 50px;
}

.deleteNote,
.addNote {
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: 4px;
  cursor: pointer;
  background: #aca7a7;
}

.deleteNote:hover,
.addNote:hover {
  background: rgb(222, 216, 216);
}

.deleteNote img,
.addNote img {
  width: 16px;
  height: 16px;
}

.addNote {
  width: 100%;
}
</style>
