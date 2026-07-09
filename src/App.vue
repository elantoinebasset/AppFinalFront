<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { schedulerApi } from './services/api'

const tabs = [
  { id: 'dashboard', label: 'Accueil' },
  { id: 'calendar', label: 'Calendrier' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'schedules', label: 'Emplois du temps' },
]

const ADMIN_ROLE = 'ADMIN'

// Etat global de l'application
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

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const googleButton = ref(null)
const googleEnabled = computed(
  () => Boolean(googleClientId) && !googleClientId.includes('your-client-id'),
)

// Formulaires
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
  priority: 1,
  color: '#1f7a8c',
})

const editingScheduleId = ref(null)
const editScheduleForm = reactive({
  name: '',
  description: '',
  priority: 1,
  color: '#1f7a8c',
  isActive: true,
})

const editingItemId = ref(null)
const editItemForm = reactive({
  title: '',
  description: '',
  location: '',
  category: 'Travail',
  startTime: '',
  endTime: '',
  priority: 1,
  notes: '',
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

// Donnees derivees (computed)
const selectedUser = computed(
  () => users.value.find((user) => user.id === selectedUserId.value) ?? null,
)

const currentUserRole = computed(() => {
  const role = currentUser.value?.role
  return typeof role === 'string' ? role.toUpperCase() : 'USER'
})

const isAdmin = computed(() => currentUserRole.value === ADMIN_ROLE)

const visibleTabs = computed(() => {
  if (isAdmin.value) {
    return tabs
  }
  return tabs.filter((tab) => tab.id !== 'users')
})

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

// ===== Calendrier mensuel =====
const weekDayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const calendarCursor = ref(new Date())

// Tous les evenements de tous les emplois du temps, avec la couleur de leur EDT
const allEvents = computed(() =>
  schedules.value.flatMap((schedule) =>
    (schedule.items ?? []).map((item) => ({
      ...item,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      color: schedule.color || '#1f7a8c',
    })),
  ),
)

const calendarTitle = computed(() => {
  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
    calendarCursor.value,
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
})

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatTime(value) {
  if (!value) {
    return ''
  }
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  )
}

// Grille du mois : cases du lundi au dimanche, incluant les jours des mois adjacents
const calendarCells = computed(() => {
  const cursor = calendarCursor.value
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const offset = (firstOfMonth.getDay() + 6) % 7 // 0 = lundi
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeksCount = Math.ceil((offset + daysInMonth) / 7)
  const today = new Date()
  const cells = []

  for (let i = 0; i < weeksCount * 7; i++) {
    const date = new Date(year, month, 1 - offset + i)
    const events = allEvents.value
      .filter((event) => event.startTime && sameDay(new Date(event.startTime), date))
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    cells.push({
      key: date.toISOString(),
      date,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: sameDay(date, today),
      events,
    })
  }

  return cells
})

function prevMonth() {
  calendarCursor.value = new Date(
    calendarCursor.value.getFullYear(),
    calendarCursor.value.getMonth() - 1,
    1,
  )
}

function nextMonth() {
  calendarCursor.value = new Date(
    calendarCursor.value.getFullYear(),
    calendarCursor.value.getMonth() + 1,
    1,
  )
}

function goToday() {
  calendarCursor.value = new Date()
}

// Clic sur un evenement du calendrier : ouvre la modale d'edition
function openEventFromCalendar(event) {
  selectedScheduleId.value = event.scheduleId
  openEditItem(event)
}

// Clic sur une case du calendrier : pre-remplit un nouvel evenement ce jour-la
function startEventOnDay(cell) {
  const start = new Date(cell.date)
  start.setHours(9, 0, 0, 0)
  const end = new Date(start)
  end.setHours(10, 0, 0, 0)
  itemForm.startTime = toInputDateTime(start)
  itemForm.endTime = toInputDateTime(end)
  activeTab.value = 'schedules'
}

// Helpers d'affichage et de messages
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

function validationLabel(item) {
  return item.validated ? 'Validé ✔' : 'En cours'
}

function validationTitle(item) {
  return item.validated ? 'Validé' : 'Cliquer pour valider'
}

function validationColor(item) {
  return item.validated ? 'green' : 'red'
}

function canManageSelectedUser() {
  if (isAdmin.value) {
    return true
  }
  return selectedUserId.value === currentUser.value?.id
}

function deleteLabel(user, item, schedule) {
    if (item) {
        return 'Supprimer cet événement'
    }
    if (user) {
        return 'Supprimer cet utilisateur'
    }
    if (schedule) {
        return 'Supprimer cet emploi du temps'
    }
}

function modifyLabel(user, item, schedule) {
    if (item) {
        return 'Modifier cet événement'
    }
    if (user) {
        return 'Modifier cet utilisateur'
    }
    if (schedule) {
        return 'Modifier cet emploi du temps'
    }
}

// Chargement des donnees
async function initializeUserData() {
  if (!currentUser.value) {
    users.value = []
    schedules.value = []
    selectedUserId.value = null
    selectedScheduleId.value = null
    return
  }

  users.value = [currentUser.value]
  selectedUserId.value = currentUser.value.id
  await loadSchedulesForSelectedUser()
}

async function refreshUsers() {
  if (!isAdmin.value) {
    await initializeUserData()
    return
  }

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

async function initializeAppData() {
  resetMessages()
  isLoading.value = true

  try {
    health.value = await schedulerApi.getHealth()
    if (isAdmin.value) {
      await refreshUsers()
    } else {
      await initializeUserData()
    }
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

// Authentification
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

    // Pas de token = l'email doit d'abord etre verifie
    if (!response.token) {
      authMode.value = 'login'
      Object.assign(registerForm, {
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
      })
      showSuccess(
        'Compte créé ! Un email de vérification a été envoyé. Vérifiez votre boîte mail, puis connectez-vous.',
      )
      return
    }
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

async function handleGoogleCredential(response) {
  resetMessages()
  authSubmitting.value = true

  try {
    const result = await schedulerApi.googleLogin(response.credential)
    currentUser.value = result.user
    isAuthenticated.value = true
    showSuccess(`Bienvenue ${result.user.firstName}.`)
    await initializeAppData()
  } catch (error) {
    showError(error)
  } finally {
    authSubmitting.value = false
  }
}

function initGoogleSignIn(attempt = 0) {
  if (!googleEnabled.value) {
    return
  }

  if (!window.google?.accounts?.id) {
    if (attempt < 20) {
      setTimeout(() => initGoogleSignIn(attempt + 1), 250)
    }
    return
  }

  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleGoogleCredential,
  })

  if (googleButton.value) {
    window.google.accounts.id.renderButton(googleButton.value, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'signin_with',
      shape: 'pill',
    })
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

// Gestion des utilisateurs
async function deleteUser(user){
  if (!isAdmin.value) {
    errorMessage.value = 'Action reservee aux administrateurs.'
    return
  }

    if (!user) {
        errorMessage.value = 'Aucun utilisateur sélectionné pour la suppression.'
        return
    }
    resetMessages()

    try{
        await schedulerApi.deleteUser(user.id)
        const index = users.value.findIndex((u) => u.id === user.id)
        if (index !== -1) {
            users.value.splice(index, 1)
            if (selectedUserId.value === user.id) {
                selectedUserId.value = users.value.length > 0 ? users.value[0].id : null
                showSuccess(`Utilisateur ${user.username} supprimé.`)
            }
        }
    } catch (error) {
        showError(error)
    }
}

async function handleUserSelection(userId) {
  if (!isAdmin.value) {
    return
  }

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
  if (!isAdmin.value) {
    errorMessage.value = 'Action reservee aux administrateurs.'
    return
  }

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

// Gestion des emplois du temps
async function submitSchedule() {
  if (!selectedUserId.value) {
    errorMessage.value = 'Cree ou selectionne un utilisateur avant d ajouter un emploi du temps.'
    return
  }

  if (!canManageSelectedUser()) {
    errorMessage.value = 'Tu ne peux creer des emplois du temps que pour ton compte.'
    return
  }

  resetMessages()
  isSubmitting.value = true

  try {
    const createdSchedule = await schedulerApi.createSchedule(selectedUserId.value, {
      ...scheduleForm,
      isActive: true,
    })
    showSuccess(`Emploi du temps ${createdSchedule.name} créé.`)
    Object.assign(scheduleForm, {
      name: '',
      description: '',
      priority: 1,
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

// Gestion des evenements
async function deleteItem(item) {
  if (!selectedScheduleId.value) {
    errorMessage.value = 'Sélectionne un emploi du temps avant de supprimer un événement.'
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

    showSuccess(`Événement ${item.title} supprimé.`)
  } catch (error) {
    showError(error)
  }
}

async function deleteSchedule(schedule) {
  if (!schedule) {
    errorMessage.value = 'Aucun emploi du temps sélectionné pour la suppression.'
    return
  }

  if (!selectedUserId.value) {
    errorMessage.value = 'Aucun utilisateur sélectionné pour la suppression.'
    return
  }

  if (!canManageSelectedUser()) {
    errorMessage.value = 'Tu ne peux modifier que tes propres emplois du temps.'
    return
  }

  resetMessages()

  try {
    await schedulerApi.deleteSchedule(selectedUserId.value, schedule.id)

    const index = schedules.value.findIndex((s) => s.id === schedule.id)
    if (index !== -1) {
      schedules.value.splice(index, 1)
      if (selectedScheduleId.value === schedule.id) {
        selectedScheduleId.value = schedules.value.length > 0 ? schedules.value[0].id : null
        showSuccess(`Emploi du temps ${schedule.name} supprimé.`)
      }
    }
  } catch (error) {
    showError(error)
  }
}

function openEditSchedule(schedule) {
  resetMessages()
  editingScheduleId.value = schedule.id
  Object.assign(editScheduleForm, {
    name: schedule.name ?? '',
    description: schedule.description ?? '',
    priority: schedule.priority ?? '',
    color: schedule.color ?? '#1f7a8c',
    isActive: schedule.isActive ?? true,
  })
}

function closeEditSchedule() {
  editingScheduleId.value = null
}

async function submitEditSchedule() {
  if (!editingScheduleId.value) {
    return
  }

  if (!selectedUserId.value) {
    errorMessage.value = 'Aucun utilisateur sélectionné pour la modification.'
    return
  }

  resetMessages()
  isSubmitting.value = true

  try {
    const updatedSchedule = await schedulerApi.modifySchedule(
      selectedUserId.value,
      editingScheduleId.value,
      {
        name: editScheduleForm.name,
        description: editScheduleForm.description,
        priority: editScheduleForm.priority,
        color: editScheduleForm.color,
        isActive: editScheduleForm.isActive,
      },
    )

    const index = schedules.value.findIndex((s) => s.id === updatedSchedule.id)
    if (index !== -1) {
      schedules.value[index] = updatedSchedule
    }
    showSuccess(`Emploi du temps ${updatedSchedule.name} modifié.`)
    closeEditSchedule()
  } catch (error) {
    showError(error)
  } finally {
    isSubmitting.value = false
  }
}

async function modifySchedule(schedule) {
  if (!schedule) {
    errorMessage.value = 'Aucun emploi du temps sélectionné pour la modification.'
    return
  }

  if (!selectedUserId.value) {
    errorMessage.value = 'Aucun utilisateur sélectionné pour la modification.'
    return
  }

  resetMessages()

  try {
    const updatedSchedule = await schedulerApi.modifySchedule(selectedUserId.value, schedule.id, {
      name: schedule.name,
      description: schedule.description,
      color: schedule.color,
      isActive: schedule.isActive,
    })

    const index = schedules.value.findIndex((s) => s.id === updatedSchedule.id)
    if (index !== -1) {
      schedules.value[index] = updatedSchedule
      showSuccess(`Emploi du temps ${updatedSchedule.name} modifié.`)
    }
  } catch (error) {
    showError(error)
  }
}

function toggleItemValidation(item) {
  item.validated = !item.validated
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

function toInputDateTime(value) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function openEditItem(item) {
  resetMessages()
  editingItemId.value = item.id
  Object.assign(editItemForm, {
    title: item.title ?? '',
    description: item.description ?? '',
    location: item.location ?? '',
    category: item.category ?? 'Travail',
    startTime: toInputDateTime(item.startTime),
    endTime: toInputDateTime(item.endTime),
    priority: item.priority ?? 1,
    notes: item.notes ?? '',
  })
}

function closeEditItem() {
  editingItemId.value = null
}

async function submitEditItem() {
  if (!editingItemId.value) {
    return
  }

  if (!selectedScheduleId.value) {
    errorMessage.value = 'Aucun emploi du temps sélectionné pour la modification.'
    return
  }

  resetMessages()
  isSubmitting.value = true

  try {
    const updatedItem = await schedulerApi.modifyItem(
      selectedScheduleId.value,
      editingItemId.value,
      {
        title: editItemForm.title,
        description: editItemForm.description,
        location: editItemForm.location,
        category: editItemForm.category,
        startTime: editItemForm.startTime,
        endTime: editItemForm.endTime,
        priority: Number(editItemForm.priority),
        notes: editItemForm.notes,
      },
    )

    const schedule = schedules.value.find((s) => s.id === selectedScheduleId.value)
    if (schedule) {
      const index = schedule.items.findIndex((entry) => entry.id === updatedItem.id)
      if (index !== -1) {
        schedule.items[index] = updatedItem
      }
    }
    showSuccess(`Événement ${updatedItem.title} modifié.`)
    closeEditItem()
  } catch (error) {
    showError(error)
  } finally {
    isSubmitting.value = false
  }
}

// Lifecycle
onMounted(() => {
  handleVerificationRedirect()
  tryAutoLogin()
  initGoogleSignIn()
})

// Message affiche apres le clic sur le lien de verification d'email
function handleVerificationRedirect() {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('verified')) {
    return
  }

  if (params.get('verified') === '1') {
    showSuccess('Ton adresse email a été vérifiée ✅ Tu peux maintenant te connecter.')
  } else {
    showError('Le lien de vérification est invalide ou a expiré.')
  }

  // Nettoie l'URL pour ne pas re-afficher le message au rechargement
  window.history.replaceState({}, '', window.location.pathname)
}

watch(isAdmin, (admin) => {
  if (!admin && activeTab.value === 'users') {
    activeTab.value = 'dashboard'
  }
})
</script>

<template>
  <div class="app-shell">


    <!-- ===== Section: Ecran d'authentification ===== -->
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

        <div v-if="googleEnabled" class="google-auth">
          <div class="auth-divider"><span>ou</span></div>
          <div ref="googleButton" class="google-button"></div>
        </div>

        <div class="message-stack">
          <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
          <p v-if="successMessage" class="message success">{{ successMessage }}</p>
        </div>
      </article>
    </section>

    <template v-else>
      <!-- ===== Section: Espace connecte ===== -->
      <!-- Entete et statut API -->
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
            <p v-if="currentUser">Connecté en tant que {{ currentUser.username }} ({{ currentUserRole }})</p>
            <div class="auth-actions">
              <button class="secondary-button" type="button" @click="initializeAppData">Rafraîchir</button>
              <button class="secondary-button" type="button" @click="logout">Se déconnecter</button>
            </div>
          </div>
        </div>
      </header>

      <!-- Contenu principal -->
      <main class="layout-grid">
        <!-- Barre laterale: navigation, metriques, messages -->
        <section class="panel sidebar-panel">
          <nav class="tab-list" aria-label="Navigation principale">
            <button
              v-for="tab in visibleTabs"
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
              <span class="metric-label">Événements</span>
              <strong>{{ totalItems }}</strong>
            </article>
            <article class="metric-card">
              <span class="metric-label">Accomplis</span>
              <strong>{{ completedItems }}</strong>
            </article>
          </div>

          <div class="message-stack">
            <p v-if="isLoading" class="message info">Chargement des données...</p>
            <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
            <p v-if="successMessage" class="message success">{{ successMessage }}</p>
          </div>

          <div class="selection-card">
            <h2>Utilisateur sélectionné</h2>
            <p v-if="selectedUser">
              <strong>{{ selectedUser.firstName }} {{ selectedUser.lastName }}</strong>
              <br>
              {{ selectedUser.email }}
            </p>
            <p v-else>Aucun utilisateur disponible pour le moment.</p>
          </div>
        </section>

        <!-- Zone de contenu principale par onglet -->
        <section class="panel content-panel">
          <!-- Onglet: Dashboard -->
          <section v-if="activeTab === 'dashboard'" class="content-section">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Accueil</p>
                <h2>Vue d'ensemble du planning</h2>
              </div>
            </div>

            <div class="timeline-card">
              <h3>Emplois du temps chargés</h3>
              <div v-if="schedules.length === 0" class="empty-state">Aucun emploi du temps pour l'utilisateur sélectionné.</div>
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
                    <span class="badge">{{ schedule.items?.length ?? 0 }} événements</span>
                  </div>
                </button>
              </div>
            </div>
          </section>

          <!-- Onglet: Calendrier -->
          <section v-else-if="activeTab === 'calendar'" class="content-section">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Calendrier</p>
                <h2>{{ calendarTitle }}</h2>
              </div>
              <div class="calendar-controls">
                <button class="secondary-button" type="button" title="Mois précédent" @click="prevMonth">‹</button>
                <button class="secondary-button" type="button" @click="goToday">Aujourd'hui</button>
                <button class="secondary-button" type="button" title="Mois suivant" @click="nextMonth">›</button>
              </div>
            </div>

            <div class="calendar">
              <div class="calendar-weekdays">
                <span v-for="label in weekDayLabels" :key="label">{{ label }}</span>
              </div>
              <div class="calendar-grid">
                <div
                  v-for="cell in calendarCells"
                  :key="cell.key"
                  class="calendar-cell"
                  :class="{ 'out-month': !cell.inMonth, 'is-today': cell.isToday }"
                  @click="startEventOnDay(cell)"
                >
                  <span class="calendar-daynum">{{ cell.day }}</span>
                  <div class="calendar-events">
                    <button
                      v-for="event in cell.events"
                      :key="event.id"
                      type="button"
                      class="calendar-event"
                      :style="{ '--event-color': event.color }"
                      :title="`${event.title} · ${formatTime(event.startTime)} → ${formatTime(event.endTime)}`"
                      @click.stop="openEventFromCalendar(event)"
                    >
                      <span class="calendar-event-time">{{ formatTime(event.startTime) }}</span>
                      <span class="calendar-event-title">{{ event.title }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Onglet: Utilisateurs -->
          <section v-else-if="activeTab === 'users'" class="content-section two-column-section2">
            <div>
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Liste</p>
                  <h2>Utilisateurs existants</h2>
                </div>
              </div>

              <div v-if="users.length === 0" class="empty-state">Aucun utilisateur enregistré pour le moment.</div>

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

                  <span class="user-card-top">
                  <span>{{ user.email }}</span>
                  <span v-if="isAdmin" :title="deleteLabel(user)" @click="deleteUser(user)">🗑️</span>
                  </span>
                </button>
              </div>
            </div>

            <div>
              <div class="section-heading">
                <div>
                  <p class="eyebrowInfo">Informations utilisateurs</p>
                  <div class="user-card selected">
                    <strong><h4 class="textInfo">Utilisateur</h4>{{ selectedUser ? selectedUser.firstName + ' ' + selectedUser.lastName :
                     'Aucun utilisateur sélectionné' }}</strong>
                    <h4 class="textInfo">Email</h4><p>{{ selectedUser ? selectedUser.email : '' }}</p>
                    <h4 class="textInfo">Statut</h4><p>{{ selectedUser ? (selectedUser.isActive ? 'Actif' : 'Inactif') : '' }}</p>
                    <h4 class="textInfo">Tâches Actives</h4><p>{{ selectedUser ? totalItems : '' }}</p>
                    <h4 class="textInfo">Rôle</h4><p>{{ selectedUser ? selectedUser.role : '' }}</p>
                    <button class="primary-button" @click="activeTab = 'schedules'">Voir l'emploi du temps de {{ selectedUser ? selectedUser.firstName : '' }}</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Onglet: Emplois du temps et evenements -->
          <section v-else class="content-section two-column-section schedules-section">
            <div>
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Emplois du temps</p>
                  <h2>Créer un emploi du temps</h2>
                </div>
              </div>

              <form class="form-card" @submit.prevent="submitSchedule">
                <label>
                  Nom
                  <input v-model="scheduleForm.name" required type="text" placeholder="..." />
                </label>
                <label>
                  Description
                  <textarea v-model="scheduleForm.description" rows="4" placeholder="..."></textarea>
                </label>
                <label>
                    Priorité
                    <select v-model="scheduleForm.priority">
                      <option :value="0">Basse</option>
                      <option :value="1">Moyenne</option>
                      <option :value="2">Haute</option>
                    </select>
                  </label>
                <label>
                  Couleur
                  <input v-model="scheduleForm.color" type="color" />
                </label>
                <button class="primary-button" type="submit" :disabled="isSubmitting">
                  {{ isSubmitting ? 'Création...' : 'Créer l\'emploi du temps' }}
                </button>
              </form>

              <div class="section-heading nested-heading">
                <div>
                  <p class="eyebrow">Événements</p>
                  <h2>Ajouter un événement</h2>
                </div>
              </div>

              <form class="form-card" @submit.prevent="submitItem">
                <label>
                  Titre
                  <input v-model="itemForm.title" required type="text" placeholder="..." />
                </label>
                <label>
                  Description
                  <textarea v-model="itemForm.description" rows="3" placeholder="..."></textarea>
                </label>
                <div class="field-row">
                  <label class="datetime-label">
                    Début
                    <input v-model="itemForm.startTime" required type="datetime-local" />
                  </label>
                  <label class="datetime-label">
                    Fin
                    <input v-model="itemForm.endTime" required type="datetime-local" />
                  </label>
                </div>
                <div class="field-row">
                  <label>
                    Catégorie
                    <input v-model="itemForm.category" type="text" placeholder="..." />
                  </label>
                  <label>
                    Priorité
                    <select v-model="itemForm.priority">
                      <option :value="0">Basse</option>
                      <option :value="1">Moyenne</option>
                      <option :value="2">Haute</option>
                    </select>
                  </label>
                </div>
                <label>
                  Lieu
                  <input v-model="itemForm.location" type="text" placeholder="..." />
                </label>
                <label>
                  Infos complémentaires
                  <textarea v-model="itemForm.notes" rows="3" placeholder="..."></textarea>
                </label>
                <button class="primary-button" type="submit" :disabled="isSubmitting">
                  {{ isSubmitting ? 'Ajout...' : 'Ajouter l\'événement' }}
                </button>
              </form>
            </div>

            <div>
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Liste</p>
                  <h2>Emploi du temps de l'utilisateur</h2>
                </div>
              </div>

              <div v-if="schedules.length === 0" class="empty-state">Aucun emploi du temps à afficher.</div>

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
                    <div class="schedule-actions">
                      <span :title="modifyLabel(null, null, schedule)" @click.stop="openEditSchedule(schedule)"> ✏️ </span>
                      <span :title="deleteLabel(null, null, schedule)" @click.stop="deleteSchedule(schedule)">🗑️</span>
                    </div>
                  </div>

                  <p class="schedule-meta">
                    Créé le {{ formatDate(schedule.createdAt) }} · {{ schedule.items?.length ?? 0 }} événements
                  </p>
                    <span class="badge muted-badge">{{ priorityLabel(scheduleForm.priority) }}</span>


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
                        <span :title="modifyLabel(null, item)" @click.stop="openEditItem(item)"> ✏️ </span>
                        <span :title="deleteLabel(null, item)" @click.stop="deleteItem(item)">🗑️</span>
                      </div>

                      <p>{{ item.description || 'Description non définie' }}</p>
                      <p>{{ formatDate(item.startTime) }} → {{ formatDate(item.endTime) }}</p>
                      <p>{{ item.category || 'Catégorie non définie' }} · {{ item.location || 'Lieu non défini' }}</p>
                    </article>
                    <div v-if="!schedule.items?.length" class="empty-inline">Aucun événement dans cet emploi du temps.</div>
                  </div>
                </button>
              </div>


            </div>
          </section>
        </section>
      </main>

      <!-- ===== Fin: Espace connecte ===== -->
    </template>

    <!-- ===== Section: Modales ===== -->
    <!-- Modale: edition d'un emploi du temps -->
    <div v-if="editingScheduleId" class="modal-overlay" @click.self="closeEditSchedule">
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Modifier</p>
            <h2>Modifier l'emploi du temps</h2>
          </div>
        </div>

        <form class="form-card" @submit.prevent="submitEditSchedule">
          <label>
            Nom
            <input v-model="editScheduleForm.name" required type="text" placeholder="..." />
          </label>
          <label>
            Description
            <textarea v-model="editScheduleForm.description" rows="4" placeholder="..."></textarea>
          </label>
          <label>
            Couleur
            <input v-model="editScheduleForm.color" type="color" />
          </label>
          <div class="modal-actions">
            <button class="secondary-button" type="button" @click="closeEditSchedule">Annuler</button>
            <button class="primary-button" type="submit" :disabled="isSubmitting">
              {{ isSubmitting ? 'Enregistrement...' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modale: edition d'un evenement -->
    <div v-if="editingItemId" class="modal-overlay" @click.self="closeEditItem">
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Modifier</p>
            <h2>Modifier l'événement</h2>
          </div>
        </div>

        <form class="form-card" @submit.prevent="submitEditItem">
          <label>
            Titre
            <input v-model="editItemForm.title" required type="text" placeholder="..." />
          </label>
          <label>
            Description
            <textarea v-model="editItemForm.description" rows="3" placeholder="..."></textarea>
          </label>
          <div class="field-row2">
            <label class="datetime-label">
              Début
              <input v-model="editItemForm.startTime" required type="datetime-local" />
            </label>
          </div>
          <div class="field-row2">
            <label class="datetime-label">
              Fin
              <input v-model="editItemForm.endTime" required type="datetime-local" />
            </label>
          </div>
          <div class="field-row">
            <label>
              Catégorie
              <input v-model="editItemForm.category" type="text" placeholder="..." />
            </label>
            <label>
              Priorité
              <select v-model="editItemForm.priority">
                <option :value="0">Basse</option>
                <option :value="1">Moyenne</option>
                <option :value="2">Haute</option>
              </select>
            </label>
          </div>
          <label>
            Lieu
            <input v-model="editItemForm.location" type="text" placeholder="..." />
          </label>
          <label>
            Infos complémentaires
            <textarea v-model="editItemForm.notes" rows="3" placeholder="..."></textarea>
          </label>
          <div class="modal-actions">
            <button class="secondary-button" type="button" @click="closeEditItem">Annuler</button>
            <button class="primary-button" type="submit" :disabled="isSubmitting">
              {{ isSubmitting ? 'Enregistrement...' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <!-- ===== Fin: Modales ===== -->
  </div>
</template>
