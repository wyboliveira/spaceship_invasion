/**
 * firebase.js — Inicialização do Firebase
 *
 * Este arquivo é o equivalente do antigo supabase.js.
 * Aqui conectamos o app ao projeto Firebase e exportamos as duas
 * ferramentas que vamos usar em todo o projeto:
 *
 *   auth  → Firebase Authentication (login, logout, sessão do usuário)
 *   db    → Firestore (banco de dados NoSQL em tempo real)
 *
 * ─── Por que exportar instâncias e não o app inteiro? ────────────────────────
 * Cada módulo importa só o que precisa (auth ou db), deixando o bundle menor.
 * O Vite/bundler faz "tree-shaking" — remove o que não for importado.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// initializeApp: registra as credenciais e cria a instância central do Firebase.
// É como o "new Client()" do Supabase — deve ser chamado UMA vez em todo o app.
import { initializeApp }    from 'firebase/app';

// getAuth: retorna o serviço de autenticação vinculado ao app.
// Gerencia login, logout, sessão (token JWT) e observer de mudança de estado.
import { getAuth }          from 'firebase/auth';

// getFirestore: retorna a instância do banco de dados Firestore.
// Firestore é NoSQL orientado a documentos — sem SQL, sem tabelas, sem cold start.
import { getFirestore }     from 'firebase/firestore';

// ─── Credenciais do projeto ───────────────────────────────────────────────────
// Lidas das variáveis de ambiente (.env) via import.meta.env (recurso do Vite).
// Diferente de uma senha de banco de dados SQL, estas chaves são seguras para
// ficar no código client-side — a segurança real fica nas Security Rules do
// Firestore (equivalente ao RLS do Supabase).
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// ─── Verificação de credenciais ───────────────────────────────────────────────
// Se o .env não estiver configurado, avisamos no console e desabilitamos o auth
// em vez de quebrar toda a aplicação (permite rodar em modo guest/dev).
const hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId;
if (!hasConfig) {
  console.warn('[Firebase] Credenciais ausentes no .env — auth e banco desabilitados.');
}

// ─── Inicialização condicional ────────────────────────────────────────────────
// Só inicializa se as credenciais existirem, para não lançar exceção em dev.
// null é retornado quando firebase não está configurado — todos os módulos
// que importam auth/db verificam "if (!auth)" antes de chamar qualquer função.
let app  = null;
let auth = null;
let db   = null;

if (hasConfig) {
  // initializeApp registra o projeto e retorna o "app" — objeto raiz do Firebase.
  // Todos os serviços (auth, firestore, storage...) derivam deste app.
  app  = initializeApp(firebaseConfig);

  // getAuth(app) retorna o serviço de autenticação para ESTE app específico.
  // Importante passar o app quando se usa mais de um projeto Firebase.
  auth = getAuth(app);

  // getFirestore(app) retorna a instância do banco Firestore.
  // Queries, leituras e escritas são feitas através deste objeto.
  db   = getFirestore(app);
}

export { auth, db };
