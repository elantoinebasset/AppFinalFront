<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { schedulerApi } from './services/api';

const tabs = [
  { id: 'dashboard', label: 'Accueil' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'schedules', label: 'Emplois du temps' },
];

const activeTab = ref('dashboard');
const isLoading = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const health = ref({ status: 'UNKNOWN', message: 'Vérification en cours...' });
const users = ref([]);
const schedules = ref([]);
const selectedUserId = ref(null);
const selectedScheduleId = ref(null);

const userForm = reactive({
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  isActive: true,
});

const scheduleForm = reactive({
  name: '',
  description: '',
  color: '#1f7a8c',
});

const itemForm = reactive({
  title: '',
  description: '',
  location: '',
  category: 'Travail',
  startTime: '',
  endTime: '',
  priority: 1,
  notes: '',
});

const selectedUser = computed(
  () => users.value.find((user) => user.id === selectedUserId.value) ?? null,
);

const selectedSchedule = computed(
  () =>
    schedules.value.find(
      (schedule) => schedule.id === selectedScheduleId.value,
    ) ?? null,
);

const totalItems = computed(() =>
  schedules.value.reduce(
    (total, schedule) => total + (schedule.items?.length ?? 0),
    0,
  ),
);

const completedItems = computed(() =>
  schedules.value.reduce(
    (total, schedule) =>
      total + (schedule.items?.filter((item) => item.isCompleted).length ?? 0),
    0,
  ),
);

function resetMessages() {
  errorMessage.value = '';
  successMessage.value = '';
}

function showError(error) {
  errorMessage.value =
    error instanceof Error ? error.message : 'Une erreur est survenue.';
}

function showSuccess(message) {
  successMessage.value = message;
}


// Functions validation
function validationLabel(item) {
  return item.validated ? 'Terminé' : 'En cours';
}

function validationTitle(item) {
  return item.validated ? 'Validé' : 'Cliquer pour valider';
}

function validationColor(item) {
  return item.validated ? 'green' : 'red';
}

function toggleItemValidation(item) {
  item.validated = !item.validated;
}


async function initialize() {
  resetMessages();
  isLoading.value = true;

  try {
    health.value = await schedulerApi.getHealth();
    await refreshUsers();
  } catch (error) {
    showError(error);
    health.value = {
      status: 'DOWN',
      message: 'Impossible de joindre le backend Quarkus.',
    };
  } finally {
    isLoading.value = false;
  }
}

async function refreshUsers() {
  const fetchedUsers = await schedulerApi.getUsers();
  users.value = fetchedUsers;

  if (fetchedUsers.length === 0) {
    selectedUserId.value = null;
    schedules.value = [];
    selectedScheduleId.value = null;
    return;
  }

  if (
    !selectedUserId.value ||
    !fetchedUsers.some((user) => user.id === selectedUserId.value)
  ) {
    selectedUserId.value = fetchedUsers[0].id;
  }

  await loadSchedulesForSelectedUser();
}

async function loadSchedulesForSelectedUser() {
  if (!selectedUserId.value) {
    schedules.value = [];
    selectedScheduleId.value = null;
    return;
  }

  const fetchedSchedules = await schedulerApi.getSchedulesByUser(
    selectedUserId.value,
  );
  schedules.value = fetchedSchedules;

  if (fetchedSchedules.length === 0) {
    selectedScheduleId.value = null;
    return;
  }

  if (
    !selectedScheduleId.value ||
    !fetchedSchedules.some(
      (schedule) => schedule.id === selectedScheduleId.value,
    )
  ) {
    selectedScheduleId.value = fetchedSchedules[0].id;
  }
}

async function handleUserSelection(userId) {
  resetMessages();
  selectedUserId.value = userId;
  selectedScheduleId.value = null;

  try {
    await loadSchedulesForSelectedUser();
  } catch (error) {
    showError(error);
  }
}

async function submitUser() {
  resetMessages();
  isSubmitting.value = true;

  try {
    const createdUser = await schedulerApi.createUser({ ...userForm });
    showSuccess(`Utilisateur ${createdUser.username} créé.`);
    Object.assign(userForm, {
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      isActive: true,
    });
    await refreshUsers();
    selectedUserId.value = createdUser.id;
    activeTab.value = 'users';
  } catch (error) {
    showError(error);
  } finally {
    isSubmitting.value = false;
  }
}

async function submitSchedule() {
  if (!selectedUserId.value) {
    errorMessage.value =
      'Crée ou sélectionne un utilisateur avant d’ajouter un emploi du temps.';
    return;
  }

  resetMessages();
  isSubmitting.value = true;

  try {
    const createdSchedule = await schedulerApi.createSchedule(
      selectedUserId.value,
      {
        ...scheduleForm,
        isActive: true,
      },
    );
    showSuccess(`Emploi du temps ${createdSchedule.name} créé.`);
    Object.assign(scheduleForm, {
      name: '',
      description: '',
      color: '#1f7a8c',
    });
    await loadSchedulesForSelectedUser();
    selectedScheduleId.value = createdSchedule.id;
    activeTab.value = 'schedules';
  } catch (error) {
    showError(error);
  } finally {
    isSubmitting.value = false;
  }
}

async function submitItem() {
  if (!selectedScheduleId.value) {
    errorMessage.value =
      'Sélectionne un emploi du temps avant d’ajouter un événement.';
    return;
  }

  resetMessages();
  isSubmitting.value = true;

  try {
    await schedulerApi.createItem(selectedScheduleId.value, {
      ...itemForm,
      isCompleted: false,
      priority: Number(itemForm.priority),
    });
    showSuccess(`Événement ${itemForm.title} ajouté.`);
    Object.assign(itemForm, {
      title: '',
      description: '',
      location: '',
      category: 'Travail',
      startTime: '',
      endTime: '',
      priority: 1,
      notes: '',
    });
    await loadSchedulesForSelectedUser();
  } catch (error) {
    showError(error);
  } finally {
    isSubmitting.value = false;
  }
}

function formatDate(value) {
  if (!value) {
    return 'Non défini';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function priorityLabel(priority) {
  if (priority === 2) {
    return 'Haute';
  }
  if (priority === 1) {
    return 'Moyenne';
  }
  return 'Basse';
}

onMounted(() => {
  initialize();
});
</script>

<template>
  <div class="app-shell">
    <header class="hero-panel">
      <div class="Ap-Title">
        <h1 class="eyebrow">Time Scheduler</h1>
      </div>
      <div class="API-Status">
      <div class="API-Infant-status">
        <div
          class="status-pill"
          :class="health.status === 'UP' ? 'status-up' : 'status-down'"> <!-- if up = status up, if up != status down -->

          <span class="status-dot"></span>
          {{ health.status }}
        </div>
        <p>{{ health.message }}</p>
        <button class="secondary-button" type="button" @click="initialize">
          Rafraîchir
        </button>
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
            <span class="metric-label">Événements</span>
            <strong>{{ totalItems }}</strong>
          </article>
          <article class="metric-card">
            <span class="metric-label">Terminés</span>
            <strong>{{ completedItems }}</strong>
          </article>
        </div>

        <div class="message-stack">
          <p v-if="isLoading" class="message info">Chargement des données…</p>
          <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
          <p v-if="successMessage" class="message success">
            {{ successMessage }}
          </p>
        </div>

        <div class="selection-card">
          <h2>Utilisateur sélectionné</h2>
          <p v-if="selectedUser">
            <strong
              >{{ selectedUser.firstName }} {{ selectedUser.lastName }}</strong>
            <br>
            <!-- {{ selectedUser.username }} -->
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
              <h2>Vue d’ensemble du planning</h2>
            </div>
          </div>

          <!-- <div class="overview-grid">
            <article class="overview-card accent-card">
              <h3>Architecture front</h3>
              <p>
                Le front appelle l’API via <code>/api</code>. Vite redirige
                ensuite ces appels vers Quarkus sur
                <code>http://localhost:8080</code>.
              </p>
            </article>

            <article class="overview-card">
              <h3>Ce que tu peux faire maintenant</h3>
              <ul>
                <li>Créer un utilisateur</li>
                <li>Créer un emploi du temps lié à cet utilisateur</li>
                <li>Ajouter des événements dans cet emploi du temps</li>
              </ul>
            </article>
          </div> -->

          <div class="timeline-card">
            <h3>Emplois du temps chargés</h3>
            <div v-if="schedules.length === 0" class="empty-state">
              Aucun emploi du temps pour l’utilisateur sélectionné.
            </div>
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
                  <span class="badge"
                    >{{ schedule.items?.length ?? 0 }} items</span
                  >
                </div>
            </button>
            </div>
          </div>

        </section>

        <section
          v-else-if="activeTab === 'users'"
          class="content-section two-column-section"
        >
          <div>
            <div class="section-heading">
              <div>
                <p class="eyebrow">Utilisateurs</p>
                <h2>Créer et sélectionner un utilisateur</h2>
              </div>
            </div>

            <form class="form-card" @submit.prevent="submitUser">
              <label>
                Username
                <input
                  v-model="userForm.username"
                  required
                  type="text"
                  placeholder="jean.dupont"
                />
              </label>
              <label>
                Email
                <input
                  v-model="userForm.email"
                  required
                  type="email"
                  placeholder="jean@mail.com"
                />
              </label>
              <div class="field-row">
                <label>
                  Prénom
                  <input
                    v-model="userForm.firstName"
                    required
                    type="text"
                    placeholder="Jean"
                  />
                </label>
                <label>
                  Nom
                  <input
                    v-model="userForm.lastName"
                    required
                    type="text"
                    placeholder="Dupont"
                  />
                </label>
              </div>
              <button
                class="primary-button"
                type="submit"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Création…' : 'Créer l’utilisateur' }}
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

            <div v-if="users.length === 0" class="empty-state">
              Aucun utilisateur enregistré pour le moment.
            </div>

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
                  <span class="badge muted-badge">{{
                    user.isActive ? 'Actif' : 'Inactif'
                  }}</span>
                </span>
                <!-- <span>{{ user.username }} </span> -->
                <span>{{ user.email }}</span>
              </button>
            </div>
          </div>
        </section>

        <section
          v-else
          class="content-section two-column-section schedules-section"
        >
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
                <input
                  v-model="scheduleForm.name"
                  required
                  type="text"
                  placeholder="..."
                />
              </label>
              <label>
                Description
                <textarea
                  v-model="scheduleForm.description"
                  rows="4"
                  placeholder="..."
                ></textarea>
              </label>
              <label>
                Couleur
                <input v-model="scheduleForm.color" type="color" />
              </label>
              <button
                class="primary-button"
                type="submit"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Création…' : 'Créer l’emploi du temps' }}
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
                <input
                  v-model="itemForm.title"
                  required
                  type="text"
                  placeholder="..."
                />
              </label>
              <label>
                Description
                <textarea
                  v-model="itemForm.description"
                  rows="3"
                  placeholder="..."
                ></textarea>
              </label>
              <div class="field-row">
                <label>
                  Début
                  <input
                    v-model="itemForm.startTime"
                    required
                    type="datetime-local"
                  />
                </label>
                <label>
                  Fin
                  <input
                    v-model="itemForm.endTime"
                    required
                    type="datetime-local"
                  />
                </label>
              </div>
              <div class="field-row">
                <label>
                  Catégorie
                  <input
                    v-model="itemForm.category"
                    type="text"
                    placeholder="Cours"
                  />
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
                <input
                  v-model="itemForm.location"
                  type="text"
                  placeholder="..."
                />
              </label>
              <label>
                Infos complémentaires
                <textarea
                  v-model="itemForm.notes"
                  rows="3"
                  placeholder="..."
                ></textarea>
              </label>
              <button
                class="primary-button"
                type="submit"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Ajout…' : 'Ajouter l’événement' }}
              </button>
            </form>
          </div>

          <div>
            <div class="section-heading">
              <div>
                <p class="eyebrow">Liste</p>
                <h2>Emplois du temps de l’utilisateur</h2>
              </div>
            </div>

            <div v-if="schedules.length === 0" class="empty-state">
              Aucun emploi du temps à afficher.
            </div>

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
                  <span class="badge">{{
                    schedule.isActive ? 'Actif' : 'Inactif'
                  }}</span>
                </div>

                <p class="schedule-meta">
                  Créé le {{ formatDate(schedule.createdAt) }} ·
                  {{ schedule.items?.length ?? 0 }} événements
                </p>

                <div
                  v-if="schedule.id === selectedScheduleId"
                  class="item-list"
                >
                  <article
                    v-for="item in schedule.items"
                    :key="item.id"
                    class="item-card"
                  >
                    <div class="item-header">
                      <strong>{{ item.title }}</strong>
                      <span class="badge muted-badge">{{
                        priorityLabel(item.priority)
                      }}</span>
                      <span
                        :title="validationTitle(item)"
                        :style="{ cursor: 'pointer', fontSize: '1.2em', color: validationColor(item) }"
                        @click.stop="toggleItemValidation(item)"
                      >{{ validationLabel(item) }}</span>
                      <span>{{ item.validated ? '✔️' : '❌' }}</span>

                    </div>
                    <p>{{ item.description || 'Description non définie' }}</p>
                    <p>
                      {{ formatDate(item.startTime) }} →
                      {{ formatDate(item.endTime) }}
                    </p>
                    <p>
                      {{ item.category || 'Catégorie non définie' }} ·
                      {{ item.location || 'Lieu non défini' }}
                    </p>
                  </article>
                  <div v-if="!schedule.items?.length" class="empty-inline">
                    Aucun événement dans cet emploi du temps.
                  </div>
                </div>
              </button>
            </div>

            <div v-if="selectedSchedule" class="selection-card details-card">
              <h3>Détail de la sélection</h3>
              <p>
                <strong>{{ selectedSchedule.name }}</strong>
              </p>
              <p>{{ selectedSchedule.description || 'Description non définie' }}</p>
              <p>
                {{ selectedSchedule.items?.length ?? 0 }} événements associés
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  </div>
</template>
