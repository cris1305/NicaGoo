/**
 * NicaGo - Ejemplo de Autenticación con Google usando Firebase v10
 * 
 * Este archivo contiene un ejemplo completo y autoportante en JavaScript
 * para inicializar Firebase, configurar el proveedor de Google y realizar
 * la autenticación mediante una ventana emergente (Popup). This is ready to be
 * integrated into any client-side website or application.
 */

// 1. Estructura HTML sugerida para el botón de inicio de sesión:
/*
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Iniciar Sesión con Google</title>
    <!-- Estilo rápido con Tailwind CSS para máxima calidad visual -->
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-100 min-h-screen flex items-center justify-center">

    <div class="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-sm w-full text-center space-y-6">
      <h2 class="text-2xl font-black text-slate-800 tracking-tight">Bienvenido</h2>
      <p class="text-xs text-slate-500 font-bold">Inicia sesión de forma segura para continuar con tu cuenta de Google.</p>
      
      <!-- El botón de login -->
      <button 
        id="btn-google-login"
        class="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-slate-200 hover:border-slate-300 active:scale-95 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-sm cursor-pointer"
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" class="w-5 h-5">
        Ingresar con Google
      </button>

      <!-- Div para mostrar el estado y datos del usuario -->
      <div id="user-info" class="hidden space-y-3 pt-4 border-t border-slate-100">
        <p class="text-xs text-slate-400 font-bold">Conectado como:</p>
        <img id="user-photo" src="" class="w-12 h-12 rounded-full mx-auto shadow-md">
        <h4 id="user-name" class="text-sm font-black text-slate-800"></h4>
        <p id="user-email" class="text-xs text-slate-500 font-bold"></p>
      </div>
    </div>

    <!-- Script de autenticación -->
    <script type="module" src="app.js"></script>
  </body>
  </html>
*/

// ==========================================
// 2. CÓDIGO JAVASCRIPT (app.js / script modulo)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuración de credenciales de tu proyecto de Firebase
// Recuerda rellenar estos campos con los datos reales obtenidos desde la Consola de Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO_ID",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Inicializar la aplicación de Firebase
const app = initializeApp(firebaseConfig);

// Obtener la instancia de autenticación asociada
const auth = getAuth(app);

// Evento click al presionar el botón de inicio de sesión
const loginButton = document.getElementById("btn-google-login");

if (loginButton) {
  loginButton.addEventListener("click", () => {
    // Instanciar el proveedor de autenticación de Google
    const provider = new GoogleAuthProvider();
    
    // Configurar scopes opcionales si necesitas datos específicos (ejemplo: perfil/email)
    provider.addScope('profile');
    provider.addScope('email');

    console.log("Iniciando proceso de autenticación alternativo...");

    // Ejecutar inicio de sesión por popup
    signInWithPopup(auth, provider)
      .then((result) => {
        // Credencial de Google obtenida correctamente
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential ? credential.accessToken : null;
        
        // Información del usuario autenticado
        const user = result.user;
        
        console.log("Autenticación exitosa:", user);
        console.log("Token de Google obtenido:", token);

        // Actualizar la interfaz de usuario para mostrar sus datos
        const userInfoDiv = document.getElementById("user-info");
        const userPhoto = document.getElementById("user-photo");
        const userName = document.getElementById("user-name");
        const userEmail = document.getElementById("user-email");

        if (userInfoDiv && userPhoto && userName && userEmail) {
          userPhoto.src = user.photoURL || 'https://via.placeholder.com/150';
          userName.textContent = user.displayName || 'Usuario de Google';
          userEmail.textContent = user.email || '';
          
          userInfoDiv.classList.remove("hidden");
        }
      })
      .catch((error) => {
        // Manejar errores durante la autenticación
        const errorCode = error.code;
        const errorMessage = error.message;
        // El correo de la cuenta del usuario utilizada
        const email = error.customData ? error.customData.email : null;
        // La credencial Auth que se utilizó
        const credential = GoogleAuthProvider.credentialFromError(error);

        console.error("Hubo un error al autenticar con Google:", error);
        alert(`Ocurrió un error (${errorCode}): ${errorMessage}`);
      });
  });
}
