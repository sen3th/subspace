// script.js - Firebase integration for subscription management

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0Ap546vFgqFBxXtMbmj1uS2MNwEefBrU",
  authDomain: "subspace-8dbfd.firebaseapp.com",
  projectId: "subspace-8dbfd",
  storageBucket: "subspace-8dbfd.appspot.com",
  messagingSenderId: "443288216194",
  appId: "1:443288216194:web:0f65ac5ff3ae07439b8a9b",
  measurementId: "G-5V0WWQFH40",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
const loginGoogleBtn = document.getElementById("loginGoogleBtn");
const loginEmailBtn = document.getElementById("loginEmailBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmailDisplay = document.getElementById("userEmail");
const form = document.getElementById("subForm");
const subList = document.getElementById("subList");
const monthlyTotal = document.getElementById("monthlyTotal");
const yearlyTotal = document.getElementById("yearlyTotal");
const appContainer = document.querySelector(".app-container");

const emailLoginModal = document.getElementById("emailLoginModal");
const emailLoginForm = document.getElementById("emailLoginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const emailLoginError = document.getElementById("emailLoginError");
const modalCloseBtn = document.getElementById("modalCloseBtn");

const loadingSpinner = document.getElementById("loadingSpinner");

const toggleThemeBtn = document.getElementById("toggleThemeBtn");
const body = document.body;

let subscriptions = [];
let userId = null;

// Helper: show loading spinner
function showLoading(show) {
  loadingSpinner.style.display = show ? "block" : "none";
}

// Helper: update totals
function updateTotals() {
  let month = 0, year = 0;
  subscriptions.forEach((sub) => {
    if (sub.cancelled) return; // skip cancelled subs
    const price = parseFloat(sub.price);
    if (sub.frequency === "monthly") {
      month += price;
      year += price * 12;
    } else {
      year += price;
      month += price / 12;
    }
  });
  monthlyTotal.textContent = month.toFixed(2);
  yearlyTotal.textContent = year.toFixed(2);
}

// Helper: render subscriptions list
function renderList() {
  subList.innerHTML = subscriptions.length === 0 ? "<li>No subscriptions yet.</li>" : "";
  subscriptions.forEach((sub, index) => {
    const li = document.createElement("li");
    li.className = sub.cancelled ? "sub-cancelled" : "";
    li.innerHTML = `
      <div>
        <strong>${sub.name}</strong> — $${sub.price} / ${sub.frequency}<br />
        Next Billing: ${sub.nextDate}
      </div>
      <div>
        <button data-index="${index}" class="cancel-btn">${sub.cancelled ? "Undo Cancel" : "Cancel"}</button>
        <button data-index="${index}" class="remove-btn">Remove</button>
      </div>
    `;
    li.querySelector(".cancel-btn").addEventListener("click", () => toggleCancel(index));
    li.querySelector(".remove-btn").addEventListener("click", () => deleteSub(index));
    subList.appendChild(li);
  });
  updateTotals();
}

// Firestore CRUD
async function saveSubs() {
  if (!userId) return;
  showLoading(true);
  try {
    const docRef = doc(db, "subscriptions", userId);
    await setDoc(docRef, { subs: subscriptions });
  } catch (e) {
    alert("Error saving subscriptions: " + e.message);
  }
  showLoading(false);
}

async function loadSubs() {
  if (!userId) return;
  showLoading(true);
  try {
    const docRef = doc(db, "subscriptions", userId);
    const docSnap = await getDoc(docRef);
    subscriptions = docSnap.exists() ? docSnap.data().subs || [] : [];
  } catch (e) {
    alert("Error loading subscriptions: " + e.message);
    subscriptions = [];
  }
  showLoading(false);
}

// Delete subscription
async function deleteSub(index) {
  subscriptions.splice(index, 1);
  await saveSubs();
  renderList();
}

// Toggle cancel subscription
async function toggleCancel(index) {
  subscriptions[index].cancelled = !subscriptions[index].cancelled;
  await saveSubs();
  renderList();
}

// Form submission
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!userId) {
    alert("Please login first.");
    return;
  }
  const name = document.getElementById("name").value.trim();
  const price = document.getElementById("price").value;
  const nextDate = document.getElementById("nextDate").value;
  const frequency = document.getElementById("frequency").value;

  if (!name || !price || !nextDate || !frequency) {
    alert("Please fill all fields.");
    return;
  }

  subscriptions.push({ name, price, nextDate, frequency, cancelled: false });
  await saveSubs();
  renderList();
  form.reset();
});

// Google login
loginGoogleBtn.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  showLoading(true);
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Login failed: " + err.message);
  }
  showLoading(false);
});

// Email login modal controls
loginEmailBtn.addEventListener("click", () => {
  emailLoginError.textContent = "";
  emailLoginForm.reset();
  emailLoginModal.style.display = "flex";
});

modalCloseBtn.addEventListener("click", () => {
  emailLoginModal.style.display = "none";
});

// Email login/register form
emailLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  emailLoginError.textContent = "";
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    emailLoginError.textContent = "Please enter email and password.";
    return;
  }
  showLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    emailLoginModal.style.display = "none";
  } catch (signInError) {
    if (signInError.code === "auth/user-not-found") {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        emailLoginModal.style.display = "none";
      } catch (registerError) {
        emailLoginError.textContent = registerError.message;
      }
    } else {
      emailLoginError.textContent = signInError.message;
    }
  }
  showLoading(false);
});

// Logout
logoutBtn.addEventListener("click", async () => {
  showLoading(true);
  try {
    await signOut(auth);
  } catch (e) {
    alert("Error during logout: " + e.message);
  }
  showLoading(false);
});

// Auth state listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId = user.uid;
    loginGoogleBtn.style.display = "none";
    loginEmailBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    userEmailDisplay.textContent = `Signed in as ${user.email}`;
    appContainer.style.display = "block";
    await loadSubs();
    renderList();
  } else {
    userId = null;
    subscriptions = [];
    loginGoogleBtn.style.display = "inline-block";
    loginEmailBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userEmailDisplay.textContent = "";
    appContainer.style.display = "none";
    renderList();
  }
});

// Theme toggle logic
const THEME_KEY = "subspace-theme";
function setTheme(theme) {
  body.className = theme;
  localStorage.setItem(THEME_KEY, theme);
}

// Load theme from localStorage
const savedTheme = localStorage.getItem(THEME_KEY);
setTheme(savedTheme === "dark" ? "dark" : "light");

toggleThemeBtn.addEventListener("click", () => {
  const newTheme = body.classList.contains("dark") ? "light" : "dark";
  setTheme(newTheme);
});
