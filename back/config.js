// Importações do Firebase

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIGURAÇÃO E INICIALIZAÇÃO ---

// As variáveis __firebase_config e __app_id serão fornecidas pelo ambiente onde o código é executado.
// Se não forem fornecidas, usamos valores padrão.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-planner-app';

// Inicializa os serviços do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variáveis de estado da aplicação
let userId = null;
let dbRef = null; // Referência ao documento do usuário no Firestore
let plannerData = {
    priorities: [],
    habits: [],
    dailyTasks: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] }
};

// --- AUTENTICAÇÃO E CARREGAMENTO DE DADOS ---

// Esta função é chamada sempre que o estado de autenticação do usuário muda.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se o usuário estiver autenticado, configuramos as variáveis e o listener de dados.
        userId = user.uid;
        dbRef = doc(db, `artifacts/${appId}/users/${userId}/planner`);
        
        const userIdElem = document.getElementById('userId');
        if (userIdElem) userIdElem.textContent = userId;
        const userInfoElem = document.getElementById('userInfo');
        if (userInfoElem) userInfoElem.classList.remove('d-none');

        // Configura um listener para receber atualizações em tempo real do Firestore.
        onSnapshot(dbRef, (docSnap) => {
            const loadingElem = document.getElementById('loading');
            if (loadingElem) loadingElem.classList.add('d-none');
            if (docSnap.exists()) {
                // Se o documento existe, carrega os dados.
                plannerData = docSnap.data();
                // Garante que a estrutura de dados local seja válida.
                plannerData.priorities = plannerData.priorities || [];
                plannerData.habits = plannerData.habits || [];
                plannerData.dailyTasks = plannerData.dailyTasks || { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
            } else {
                // Se o documento não existe, salva os dados iniciais (vazios).
                saveData(); 
            }
            // Re-renderiza toda a interface com os dados atualizados.
            renderAll();
        }, (error) => {
            console.error("Erro ao escutar por atualizações do Firestore:", error);
            const loadingElem = document.getElementById('loading');
            if (loadingElem) loadingElem.textContent = "Erro ao carregar dados.";
        });
    }
});

// Função para iniciar a autenticação quando a página carrega.
async function initializeAuth() {
    try {
        if (!auth.currentUser) {
            const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
            if (token && typeof token === 'string' && token.length > 0) {
                // Tenta autenticação com token customizado se disponível.
                await signInWithCustomToken(auth, token);
            } else {
                // Caso contrário, usa autenticação anônima.
                await signInAnonymously(auth);
            }
        }
    } catch (error) {
        console.error("Erro na autenticação inicial:", error);
        // Se o token customizado falhar, tenta a autenticação anônima como fallback.
        if (error.code === 'auth/invalid-claims' || error.code === 'auth/invalid-custom-token') {
             try {
                await signInAnonymously(auth);
            } catch (anonError) {
                console.error("Erro na autenticação anônima de fallback:", anonError);
            }
        }
    }
}

// Inicia o processo de autenticação.
initializeAuth();

// --- FUNÇÕES DE RENDERIZAÇÃO ---

// Função principal que chama todas as outras funções de renderização.
function renderAll() {
    renderPriorities();
    renderHabits();
    renderDailyTasks();
}

// Renderiza a lista de prioridades.
function renderPriorities() {
    const list = document.getElementById('priorities-list');
    if (!list) return;
    list.innerHTML = '';
    if (plannerData.priorities.length === 0) {
        list.innerHTML = `<li class="list-group-item text-muted fst-italic">Nenhuma prioridade adicionada.</li>`;
        return;
    }
    plannerData.priorities.forEach(item => {
        const li = document.createElement('li');
        li.className = 'task-item list-group-item d-flex align-items-center justify-content-between';
        li.innerHTML = `
            <div class="form-check">
                <input class="form-check-input priority-checkbox" type="checkbox" data-id="${item.id}" ${item.completed ? 'checked' : ''} id="priority-${item.id}">
                <label class="form-check-label ${item.completed ? 'text-decoration-line-through text-muted' : ''}" for="priority-${item.id}">
                    ${item.text}
                </label>
            </div>
            <button data-id="${item.id}" class="delete-priority-btn delete-btn btn btn-sm btn-link text-danger p-0">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        list.appendChild(li);
    });
    addPriorityEventListeners();
}

// Renderiza a tabela de hábitos.
function renderHabits() {
    const list = document.getElementById('habits-list');
    if (!list) return;
    list.innerHTML = '';
    const daysOfWeek = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    if (plannerData.habits.length === 0) {
        list.innerHTML = `<tr><td colspan="9" class="text-muted fst-italic p-2">Nenhum hábito adicionado.</td></tr>`;
        return;
    }
    plannerData.habits.forEach(habit => {
        const tr = document.createElement('tr');
        tr.className = 'task-item';
        let checkboxesHTML = daysOfWeek.map(day => `
            <td>
               <input type="checkbox" data-id="${habit.id}" data-day="${day}" ${habit.days[day] ? 'checked' : ''} class="form-check-input habit-checkbox">
            </td>`).join('');
            
        tr.innerHTML = `
            <td class="text-start">${habit.text}</td>
            ${checkboxesHTML}
            <td>
                <button data-id="${habit.id}" class="delete-habit-btn delete-btn btn btn-sm btn-link text-danger p-0">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        list.appendChild(tr);
    });
    addHabitEventListeners();
}

// Renderiza as colunas de tarefas diárias.
function renderDailyTasks() {
    const daysMap = {
        monday: 'Segunda-feira', tuesday: 'Terça-feira', wednesday: 'Quarta-feira',
        thursday: 'Quinta-feira', friday: 'Sexta-feira'
    };

    Object.entries(daysMap).forEach(([dayKey, dayName]) => {
        const container = document.getElementById(`day-${dayKey}`);
        if (!container) return;
        container.innerHTML = `<h3 class="h6 fw-bold text-center mb-3">${dayName}</h3>`;
        
        const list = document.createElement('ul');
        list.className = 'list-unstyled';
        list.id = `list-${dayKey}`;

        const tasks = plannerData.dailyTasks[dayKey] || [];
        if (tasks.length === 0) {
            list.innerHTML = `<li class="text-muted fst-italic small">Nenhuma tarefa.</li>`;
        } else {
            tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item bg-white p-2 mb-2 rounded shadow-sm d-flex align-items-center justify-content-between';
                li.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input daily-task-checkbox" type="checkbox" data-day="${dayKey}" data-id="${task.id}" ${task.completed ? 'checked' : ''} id="task-${dayKey}-${task.id}">
                        <label class="form-check-label small ${task.completed ? 'text-decoration-line-through text-muted' : ''}" for="task-${dayKey}-${task.id}">
                            ${task.text}
                        </label>
                    </div>
                    <button data-day="${dayKey}" data-id="${task.id}" class="delete-daily-task-btn delete-btn btn btn-sm btn-link text-danger p-0">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `;
                list.appendChild(li);
            });
        }
        container.appendChild(list);

        const addForm = document.createElement('div');
        addForm.className = 'mt-2 d-flex gap-1';
        addForm.innerHTML = `
            <input type="text" id="input-${dayKey}" placeholder="Nova tarefa..." class="form-control form-control-sm">
            <button data-day="${dayKey}" class="add-daily-task-btn btn btn-success btn-sm">+</button>
        `;
        container.appendChild(addForm);
    });
    addDailyTaskEventListeners();
}

// --- FUNÇÕES DE MANIPULAÇÃO DE EVENTOS ---

function addPriorityEventListeners() {
    document.querySelectorAll('.priority-checkbox').forEach(cb => cb.addEventListener('change', handlePriorityCheck));
    document.querySelectorAll('.delete-priority-btn').forEach(btn => btn.addEventListener('click', handlePriorityDelete));
}

function addHabitEventListeners() {
    document.querySelectorAll('.habit-checkbox').forEach(cb => cb.addEventListener('change', handleHabitCheck));
    document.querySelectorAll('.delete-habit-btn').forEach(btn => btn.addEventListener('click', handleHabitDelete));
}

function addDailyTaskEventListeners() {
    document.querySelectorAll('.daily-task-checkbox').forEach(cb => cb.addEventListener('change', handleDailyTaskCheck));
    document.querySelectorAll('.delete-daily-task-btn').forEach(btn => btn.addEventListener('click', handleDailyTaskDelete));
    document.querySelectorAll('.add-daily-task-btn').forEach(btn => btn.addEventListener('click', handleDailyTaskAdd));
    document.querySelectorAll('.day-column input[type="text"]').forEach(input => input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Evita o comportamento padrão do Enter
            e.target.nextElementSibling.click();
        }
    }));
}

document.getElementById('add-priority-btn').addEventListener('click', () => {
    const input = document.getElementById('new-priority-input');
    if (input.value.trim()) {
        plannerData.priorities.push({ id: Date.now().toString(), text: input.value.trim(), completed: false });
        input.value = '';
        saveData().then(renderPriorities);
    }
});
document.getElementById('new-priority-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('add-priority-btn').click();
});

document.getElementById('add-habit-btn').addEventListener('click', () => {
    const input = document.getElementById('new-habit-input');
    if (input.value.trim()) {
        plannerData.habits.push({ 
            id: Date.now().toString(), 
            text: input.value.trim(), 
            days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } 
        });
        input.value = '';
        saveData().then(renderHabits);
    }
});
document.getElementById('new-habit-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('add-habit-btn').click();
});

function handlePriorityCheck(e) {
    const priority = plannerData.priorities.find(p => p.id === e.target.dataset.id);
    if (priority) {
        priority.completed = e.target.checked;
        saveData().then(renderPriorities);
    }
}

function handlePriorityDelete(e) {
    const id = e.currentTarget.dataset.id;
    plannerData.priorities = plannerData.priorities.filter(p => p.id !== id);
    saveData().then(renderPriorities);
}

function handleHabitCheck(e) {
    const { id, day } = e.target.dataset;
    const habit = plannerData.habits.find(h => h.id === id);
    if (habit) {
        habit.days[day] = e.target.checked;
        saveData(); // Não é necessário re-renderizar
    }
}

function handleHabitDelete(e) {
    const id = e.currentTarget.dataset.id;
    plannerData.habits = plannerData.habits.filter(h => h.id !== id);
    saveData().then(renderHabits);
}

function handleDailyTaskAdd(e) {
    const day = e.currentTarget.dataset.day;
    const input = document.getElementById(`input-${day}`);
    if (input.value.trim()) {
        if (!plannerData.dailyTasks[day]) plannerData.dailyTasks[day] = [];
        plannerData.dailyTasks[day].push({ id: Date.now().toString(), text: input.value.trim(), completed: false });
        input.value = '';
        saveData().then(renderDailyTasks);
    }
}

function handleDailyTaskCheck(e) {
    const { id, day } = e.target.dataset;
    const task = plannerData.dailyTasks[day].find(t => t.id === id);
    if (task) {
        task.completed = e.target.checked;
        saveData().then(renderDailyTasks);
    }
}

function handleDailyTaskDelete(e) {
    const { id, day } = e.currentTarget.dataset;
    plannerData.dailyTasks[day] = plannerData.dailyTasks[day].filter(t => t.id !== id);
    saveData().then(renderDailyTasks);
}

// --- PERSISTÊNCIA DE DADOS ---

// Salva o objeto plannerData completo no Firestore.
async function saveData() {
    if (dbRef) {
        try {
            await setDoc(dbRef, plannerData);
        } catch (error) {
            console.error("Erro ao salvar dados: ", error);
        }
    }
}

// Aguarda o DOM estar pronto antes de executar o código principal
window.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
});
