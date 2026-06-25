<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { schedulerApi } from './services/api'

const tabs = [
  { id: 'dashboard', label: 'Accueil' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'schedules', label: 'Emplois du temps' },
]

const activeTab = ref('dashboard')
const isLoading = ref(false)
const isSubmitting = ref(false)
const authSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const health = ref({ status: 'UNKNOWN', message: 'Vérification en cours...' })
const users = ref([])
const schedules = ref([])
const selectedUserId = ref(null)
const selectedScheduleId = ref(null)

const isAuthenticated = ref(false)
const currentUser = ref(null)
const authMode = ref('login')

const loginForm = reactive({
  username: '',
  password: '',
})

const registerForm = reactive({
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  password: '',
})

const userForm = reactive({
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  isActive: true,
})

const scheduleForm = reactive({
  name: '',
  description: '',
  color: '#1f7a8c',
})

const itemForm = reactive({
  title: '',
  description: '',
  location: '',
  category: 'Travail',
  startTime: '',
  endTime: '',
  priority: 1,
  notes: '',
})

const selectedUser = computed(
  () => users.value.find((user) => user.id === selectedUserId.value) ?? null,
)

const selectedSchedule = computed(
  () => schedules.value.find((schedule) => schedule.id === selectedScheduleId.value) ?? null,
)

const totalItems = computed(() =>
  schedules.value.reduce((total, schedule) => total + (schedule.items?.length ?? 0), 0),
)

const completedItems = computed(() =>
  schedules.value.reduce(
    (total, schedule) => total + (schedule.items?.filter((item) => item.isCompleted).length ?? 0),
    0,
  ),
)

function resetMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}

function showError(error) {
  errorMessage.value = error instanceof Error ? error.message : 'Une erreur est survenue.'
}

function showSuccess(message) {
  successMessage.value = message
}

function validationLabel(item) {
  return item.validated ? 'Termine ✔' : 'En cours'
}

function validationTitle(item) {
  return item.validated ? 'Valide' : 'Cliquer pour valider'
}

function validationColor(item) {
  return item.validated ? 'green' : 'red'
}

function toggleItemValidation(item) {
  item.validated = !item.validated
}

function deleteLabel() {
  return 'Supprimer cet evenement'
}

async function deleteItem(item) {
  if (!selectedScheduleId.value) {
    errorMessage.value = 'Selectionne un emploi du temps avant de supprimer un evenement.'
    return
  }

  resetMessages()

  try {
    await schedulerApi.deleteItem(selectedScheduleId.value, item.id)

    const schedule = schedules.value.find((value) => value.id === selectedScheduleId.value)
    if (schedule) {
      const index = schedule.items.findIndex((entry) => entry.id === item.id)
      if (index !== -1) {
        schedule.items.splice(index, 1)
      }
    }

    showSuccess(`Evenement ${item.title} supprime.`)
  } catch (error) {
    showError(error)
  }
}

async function initializeAppData() {
  resetMessages()
  isLoading.value = true

  try {
    health.value = await schedulerApi.getHealth()
    await refreshUsers()
  } catch (error) {
    showError(error)
    health.value = {
      status: 'DOWN',
      message: 'Impossible de joindre le backend Quarkus.',
    }
  } finally {
    isLoading.value = false
  }
}

async function tryAutoLogin() {
  if (!schedulerApi.hasToken()) {
    isAuthenticated.value = false
    return
  }

  try {
    currentUser.value = await schedulerApi.getCurrentUser()
    isAuthenticated.value = true
    await initializeAppData()
  } catch {
    schedulerApi.logout()
    isAuthenticated.value = false
  }
}

async function submitLogin() {
  resetMessages()
  authSubmitting.value = true

  try {
    const response = await schedulerApi.login({ ...loginForm })
    currentUser.value = response.user
    isAuthenticated.value = true
    showSuccess(`Bienvenue ${response.user.firstName}.`)
    await initializeAppData()
  } catch (error) {
    showError(error)
  } finally {
    authSubmitting.value = false
  }
}

async function submitRegister() {
  resetMessages()
  authSubmitting.value = true

  try {
    const response = await schedulerApi.register({ ...registerForm })
    currentUser.value = response.user
    isAuthenticated.value = true
    showSuccess(`Compte cree. Bienvenue ${response.user.firstName}.`)
    await initializeAppData()
  } catch (error) {
    showError(error)
  } finally {
    authSubmitting.value = false
  }
}

function logout() {
  schedulerApi.logout()
  isAuthenticated.value = false
  currentUser.value = null
  users.value = []
  schedules.value = []
  selectedUserId.value = null
  selectedScheduleId.value = null
  activeTab.value = 'dashboard'
  resetMessages()
}

async function refreshUsers() {
  const fetchedUsers = await schedulerApi.getUsers()
  users.value = fetchedUsers

  if (fetchedUsers.length === 0) {
    selectedUserId.value = null
    schedules.value = []
    selectedScheduleId.value = null
    return
  }

  if (!selectedUserId.value || !fetchedUsers.some((user) => user.id === selectedUserId.value)) {
    selectedUserId.value = fetchedUsers[0].id
  }

  await loadSchedulesForSelectedUser()
}

async function loadSchedulesForSelectedUser() {
  if (!selectedUserId.value) {
    schedules.value = []
    selectedScheduleId.value = null
    return
  }

  const fetchedSchedules = await schedulerApi.getSchedulesByUser(selectedUserId.value)
  schedules.value = fetchedSchedules

  if (fetchedSchedules.length === 0) {
    selectedScheduleId.value = null
    return
  }

  if (!selectedScheduleId.value || !fetchedSchedules.some((schedule) => schedule.id === selectedScheduleId.value)) {
    selectedScheduleId.value = fetchedSchedules[0].id
  }
}

async function handleUserSelection(userId) {
  resetMessages()
  selectedUserId.value = userId
  selectedScheduleId.value = null

  try {
    await loadSchedulesForSelectedUser()
  } catch (error) {
    showError(error)
  }
}

async function submitUser() {
  resetMessages()
  isSubmitting.value = true

  try {
    const createdUser = await schedulerApi.createUser({ ...userForm })
    showSuccess(`Utilisateur ${createdUser.username} cree.`)
    Object.assign(userForm, {
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      isActive: true,
    })
    await refreshUsers()
    selectedUserId.value = createdUser.id
    activeTab.value = 'users'
  } catch (error) {
    showError(error)
  } finally {
    isSubmitting.value = false
  }
}

async function submitSchedule() {
  if (!selectedUserId.value) {
    errorMessage.value = 'Cree ou selectionne un utilisateur avant d ajouter un emploi du temps.'
    return
  }

  resetMessages()
  isSubmitting.value = true

  try {
    const createdSchedule = await schedulerApi.createSchedule(selectedUserId.value, {
      ...scheduleForm,
      isActive: true,
    })
    showSuccess(`Emploi du temps ${createdSchedule.name} cree.`)
    Object.assign(scheduleForm, {
      name: '',
      description: '',
      color: '#1f7a8c',
    })
    await loadSchedulesForSelectedUser()
    selectedScheduleId.value = createdSchedule.id
    activeTab.value = 'schedules'
  } catch (error) {
    showError(error)
  } finally {
    isSubmitting.value = false
  }
}

async function submitItem() {
  if (!selectedScheduleId.value) {
    errorMessage.value = 'Selectionne un emploi du temps avant d ajouter un evenement.'
    return
  }

  resetMessages()
  isSubmitting.value = true

  try {
    await schedulerApi.createItem(selectedScheduleId.value, {
      ...itemForm,
      isCompleted: false,
      priority: Number(itemForm.priority),
    })
    showSuccess(`Evenement ${itemForm.title} ajoute.`)
    Object.assign(itemForm, {
      title: '',
      description: '',
      location: '',
      category: 'Travail',
      startTime: '',
      endTime: '',
      priority: 1,
      notes: '',
    })
    await loadSchedulesForSelectedUser()
  } catch (error) {
    showError(error)
  } finally {
    isSubmitting.value = false
  }
}

function formatDate(value) {
  if (!value) {
    return 'Non defini'
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function priorityLabel(priority) {
  if (priority === 2) {
    return 'Haute'
  }
  if (priority === 1) {
    return 'Moyenne'
  }
  return 'Basse'
}

onMounted(() => {
  tryAutoLogin()
})
</script>

<template>
  <div class="app-shell">
    <section v-if="!isAuthenticated" class="auth-screen">
      <article class="auth-card">
        <p class="eyebrow auth-eyebrow">Time Scheduler</p>
        <h2>Connexion a ton espace</h2>
        <p class="auth-subtitle">Connecte-toi pour acceder a tes emplois du temps.</p>

        <div class="auth-toggle">
          <button
            type="button"
            class="tab-button"
            :class="{ active: authMode === 'login' }"
            @click="authMode = 'login'"
          >
            Connexion
          </button>
          <button
            type="button"
            class="tab-button"
            :class="{ active: authMode === 'register' }"
            @click="authMode = 'register'"
          >
            Inscription
          </button>
        </div>

        <form v-if="authMode === 'login'" class="form-card" @submit.prevent="submitLogin">
          <label>
            Username
            <input v-model="loginForm.username" required type="text" placeholder="ton_username" />
          </label>
          <label>
            Mot de passe
            <input v-model="loginForm.password" required type="password" placeholder="********" />
          </label>
          <button class="primary-button" type="submit" :disabled="authSubmitting">
            {{ authSubmitting ? 'Connexion...' : 'Se connecter' }}
          </button>
        </form>

        <form v-else class="form-card" @submit.prevent="submitRegister">
          <div class="field-row">
            <label>
              Prenom
              <input v-model="registerForm.firstName" required type="text" placeholder="Jean" />
            </label>
            <label>
              Nom
              <input v-model="registerForm.lastName" required type="text" placeholder="Dupont" />
            </label>
          </div>
          <label>
            Username
            <input v-model="registerForm.username" required type="text" placeholder="jean.dupont" />
          </label>
          <label>
            Email
            <input v-model="registerForm.email" required type="email" placeholder="jean@mail.com" />
          </label>
          <label>
            Mot de passe
            <input v-model="registerForm.password" required minlength="6" type="password" placeholder="6 caracteres minimum" />
          </label>
          <button class="primary-button" type="submit" :disabled="authSubmitting">
            {{ authSubmitting ? 'Creation...' : 'Creer mon compte' }}
          </button>
        </form>

        <div class="message-stack">
          <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
          <p v-if="successMessage" class="message success">{{ successMessage }}</p>
        </div>
      </article>
    </section>

    <template v-else>
      <header class="hero-panel">
        <div class="Ap-Title">
          <h1 class="eyebrow">Time Scheduler</h1>
        </div>
        <div class="API-Status">
          <div class="API-Infant-status">
            <div class="status-pill" :class="health.status === 'UP' ? 'status-up' : 'status-down'">
              <span class="status-dot"></span>
              {{ health.status }}
            </div>
            <p>{{ health.message }}</p>
            <p v-if="currentUser">Connecte en tant que {{ currentUser.username }}</p>
            <div class="auth-actions">
              <button class="secondary-button" type="button" @click="initializeAppData">Rafraichir</button>
              <button class="secondary-button" type="button" @click="logout">Se deconnecter</button>
            </div>
          </div>
        </div>
      </header>

      <main class="layout-grid">
        <section class="panel sidebar-panel">
          <nav class="tab-list" aria-label="Navigation principale">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              class="tab-button"
              :class="{ active: activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </nav>

          <div class="metric-grid">
            <article class="metric-card">
              <span class="metric-label">Utilisateurs</span>
              <strong>{{ users.length }}</strong>
            </article>
            <article class="metric-card">
              <span class="metric-label">EDT actifs</span>
              <strong>{{ schedules.length }}</strong>
            </article>
            <article class="metric-card">
              <span class="metric-label">Evenements</span>
              <strong>{{ totalItems }}</strong>
            </article>
            <article class="metric-card">
              <span class="metric-label">Termines</span>
              <strong>{{ completedItems }}</strong>
            </article>
          </div>

          <div class="message-stack">
            <p v-if="isLoading" class="message info">Chargement des donnees...</p>
            <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
            <p v-if="successMessage" class="message success">{{ successMessage }}</p>
          </div>

          <div class="selection-card">
            <h2>Utilisateur selectionne</h2>
            <p v-if="selectedUser">
              <strong>{{ selectedUser.firstName }} {{ selectedUser.lastName }}</strong>
              <br>
              {{ selectedUser.email }}
            </p>
            <p v-else>Aucun utilisateur disponible pour le moment.</p>
          </div>
        </section>

        <section class="panel content-panel">
          <section v-if="activeTab === 'dashboard'" class="content-section">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Accueil</p>
                <h2>Vue d ensemble du planning</h2>
              </div>
            </div>

            <div class="timeline-card">
              <h3>Emplois du temps charges</h3>
              <div v-if="schedules.length === 0" class="empty-state">Aucun emploi du temps pour l utilisateur selectionne.</div>
              <div v-else class="schedule-list compact-list">
                <button
                  v-for="schedule in schedules"
                  :key="schedule.id"
                  class="schedule-card"
                  type="button"
                  @click="activeTab = 'schedules'"
                  :style="{ '--schedule-color': schedule.color || '#1f7a8c' }"
                >
                  <div class="schedule-header">
                    <div>
                      <h4>{{ schedule.name }}</h4>
                      <p>{{ schedule.description || 'Sans description' }}</p>
                    </div>
                    <span class="badge">{{ schedule.items?.length ?? 0 }} items</span>
                  </div>
                </button>
              </div>
            </div>
          </section>

          <section v-else-if="activeTab === 'users'" class="content-section two-column-section">
            <div>
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Utilisateurs</p>
                  <h2>Creer et selectionner un utilisateur</h2>
                </div>
              </div>

              <form class="form-card" @submit.prevent="submitUser">
                <label>
                  Username
                  <input v-model="userForm.username" required type="text" placeholder="jean.dupont" />
                </label>
                <label>
                  Email
                  <input v-model="userForm.email" required type="email" placeholder="jean@mail.com" />
                </label>
                <div class="field-row">
                  <label>
                    Prenom
                    <input v-model="userForm.firstName" required type="text" placeholder="Jean" />
                  </label>
                  <label>
                    Nom
                    <input v-model="userForm.lastName" required type="text" placeholder="Dupont" />
                  </label>
                </div>
                <button class="primary-button" type="submit" :disabled="isSubmitting">
                  {{ isSubmitting ? 'Creation...' : 'Creer l utilisateur' }}
                </button>
              </form>
            </div>

            <div>
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Liste</p>
                  <h2>Utilisateurs existants</h2>
                </div>
              </div>

              <div v-if="users.length === 0" class="empty-state">Aucun utilisateur enregistre pour le moment.</div>

              <div v-else class="user-list">
                <button
                  v-for="user in users"
                  :key="user.id"
                  type="button"
                  class="user-card"
                  :class="{ selected: user.id === selectedUserId }"
                  @click="handleUserSelection(user.id)"
                >
                  <span class="user-card-top">
                    <strong>{{ user.firstName }} {{ user.lastName }}</strong>
                    <span class="badge muted-badge">{{ user.isActive ? 'Actif' : 'Inactif' }}</span>
                  </span>
                  <span>{{ user.email }}</span>
                </button>
              </div>
            </div>
          </section>

          <section v-else class="content-section two-column-section schedules-section">
            <div>
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Emplois du temps</p>
                  <h2>Creer un emploi du temps</h2>
                </div>
              </div>

              <form class="form-card" @submit.prevent="submitSchedule">
                <label>
                  Nom
                  <input v-model="scheduleForm.name" required type="text" placeholder="Planning semaine" />
                </label>
                <label>
                  Description
                  <textarea v-model="scheduleForm.description" rows="4" placeholder="Description"></textarea>
                </label>
                <label>
                  Couleur
                  <input v-model="scheduleForm.color" type="color" />
                </label>
                <button class="primary-button" type="submit" :disabled="isSubmitting">
                  {{ isSubmitting ? 'Creation...' : 'Creer l emploi du temps' }}
                </button>
              </form>

              <div class="section-heading nested-heading">
                <div>
                  <p class="eyebrow">Evenements</p>
                  <h2>Ajouter un evenement</h2>
                </div>
              </div>

              <form class="form-card" @submit.prevent="submitItem">
                <label>
                  Titre
                  <input v-model="itemForm.title" required type="text" placeholder="Cours Java" />
                </label>
                <label>
                  Description
                  <textarea v-model="itemForm.description" rows="3" placeholder="Description"></textarea>
                </label>
                <div class="field-row">
                  <label>
                    Debut
                    <input v-model="itemForm.startTime" required type="datetime-local" />
                  </label>
                  <label>
                    Fin
                    <input v-model="itemForm.endTime" required type="datetime-local" />
                  </label>
                </div>
                <div class="field-row">
                  <label>
                    Categorie
                    <input v-model="itemForm.category" type="text" placeholder="Cours" />
                  </label>
                  <label>
                    Priorite
                    <select v-model="itemForm.priority">
                      <option :value="0">Basse</option>
                      <option :value="1">Moyenne</option>
                      <option :value="2">Haute</option>
                    </select>
                  </label>
                </div>
                <label>
                  Lieu
                  <input v-model="itemForm.location" type="text" placeholder="Salle A102" />
                </label>
                <label>
                  Infos complementaires
                  <textarea v-model="itemForm.notes" rows="3" placeholder="Notes"></textarea>
                </label>
                <button class="primary-button" type="submit" :disabled="isSubmitting">
                  {{ isSubmitting ? 'Ajout...' : 'Ajouter l evenement' }}
                </button>
              </form>
            </div>

            <div>
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Liste</p>
                  <h2>Emplois du temps de l utilisateur</h2>
                </div>
              </div>

              <div v-if="schedules.length === 0" class="empty-state">Aucun emploi du temps a afficher.</div>

              <div v-else class="schedule-list">
                <button
                  v-for="schedule in schedules"
                  :key="schedule.id"
                  type="button"
                  class="schedule-card selectable-card"
                  :class="{ selected: schedule.id === selectedScheduleId }"
                  :style="{ '--schedule-color': schedule.color || '#1f7a8c' }"
                  @click="selectedScheduleId = schedule.id"
                >
                  <div class="schedule-header">
                    <div>
                      <h3>{{ schedule.name }}</h3>
                      <p>{{ schedule.description || 'Sans description' }}</p>
                    </div>
                    <span class="badge">{{ schedule.isActive ? 'Actif' : 'Inactif' }}</span>
                  </div>

                  <p class="schedule-meta">
                    Cree le {{ formatDate(schedule.createdAt) }} · {{ schedule.items?.length ?? 0 }} evenements
                  </p>

                  <div v-if="schedule.id === selectedScheduleId" class="item-list">
                    <article v-for="item in schedule.items" :key="item.id" class="item-card">
                      <div class="item-header">
                        <strong>{{ item.title }}</strong>
                        <span class="badge muted-badge">{{ priorityLabel(item.priority) }}</span>
                        <span
                          :title="validationTitle(item)"
                          :style="{ cursor: 'pointer', fontSize: '1.2em', color: validationColor(item) }"
                          @click.stop="toggleItemValidation(item)"
                        >
                          {{ validationLabel(item) }}
                        </span>
                        <span :title="deleteLabel(item)" @click.stop="deleteItem(item)">🗑️</span>
                      </div>

                      <p>{{ item.description || 'Description non definie' }}</p>
                      <p>{{ formatDate(item.startTime) }} → {{ formatDate(item.endTime) }}</p>
                      <p>{{ item.category || 'Categorie non definie' }} · {{ item.location || 'Lieu non defini' }}</p>
                    </article>
                    <div v-if="!schedule.items?.length" class="empty-inline">Aucun evenement dans cet emploi du temps.</div>
                  </div>
                </button>
              </div>

              <div v-if="selectedSchedule" class="selection-card details-card">
                <h3>Detail de la selection</h3>
                <p>
                  <strong>{{ selectedSchedule.name }}</strong>
                </p>
                <p>{{ selectedSchedule.description || 'Description non definie' }}</p>
                <p>{{ selectedSchedule.items?.length ?? 0 }} evenements associes</p>
              </div>
            </div>
          </section>
        </section>
      </main>
    </template>
  </div>
</template>
