# 🎥 Roomly

> Aplicação web de chamadas privadas com compartilhamento de tela em tempo real.

O **Roomly** é um projeto desenvolvido com o objetivo de criar uma experiência simples de comunicação entre usuários, permitindo criar salas privadas, realizar chamadas e compartilhar a tela com outras pessoas.

O projeto busca explorar conceitos de **aplicações em tempo real**, comunicação cliente-servidor e tecnologias utilizadas em ferramentas como Discord, Google Meet e Microsoft Teams.

---

## 🚀 Objetivo do projeto

Construir uma aplicação de chamadas onde usuários possam:

- Criar uma sala privada;
- Entrar em uma sala através de um código;
- Conversar em tempo real;
- Compartilhar a tela;
- Gerenciar participantes conectados.

O projeto também tem como objetivo estudar conceitos avançados de desenvolvimento web, como:

- WebRTC;
- WebSockets;
- Comunicação em tempo real;
- Streaming de mídia;
- Arquitetura frontend/backend.

---

# 🖥️ Preview

*(Adicionar imagens ou GIFs da aplicação futuramente)*

---

# ✨ Funcionalidades

## Atualmente

- [x] Interface inicial para criação/entrada em salas;
- [x] Tela da sala de chamada;
- [x] Lista de participantes;
- [x] Controles visuais de chamada;
- [x] Layout responsivo;
- [x] Design inspirado em aplicações modernas de comunicação.

## Em desenvolvimento

- [ ] Criação real de salas;
- [ ] Sistema de entrada por código;
- [ ] Comunicação via WebSocket;
- [ ] Chamadas utilizando WebRTC;
- [ ] Compartilhamento de tela;
- [ ] Controle de microfone;
- [ ] Controle de câmera;
- [ ] Reconexão automática;
- [ ] Servidor STUN/TURN.

---

# 🛠️ Tecnologias utilizadas

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide React

## Backend (planejado)

- Node.js
- Express/Fastify
- Socket.IO

## Comunicação em tempo real

- WebRTC
- WebSocket
- STUN/TURN

---

# 📂 Estrutura do projeto

```bash
src
│
├── components
│   ├── Header
│   ├── Participants
│   ├── ScreenShare
│   └── CallControls
│
├── pages
│   ├── Home
│   └── Room
│
├── routes
│   └── index.tsx
│
├── services
│   ├── socket.ts
│   └── webrtc.ts
│
├── types
│
├── App.tsx
└── main.tsx

# ⚙️ Como executar o projeto

## Pré-requisitos

Antes de iniciar, tenha instalado:

- Node.js
- npm ou yarn

---

## Instalação

Clone o repositório:

```bash
git clone https://github.com/seu-usuario/roomly-call.git
```

Entre na pasta do projeto:

```bash
cd roomly-call
```

Instale as dependências:

```bash
npm install
```

Execute o projeto:

```bash
npm run dev
```

A aplicação estará disponível em:

```bash
http://localhost:5173
```

---

# 🧠 Conceitos estudados neste projeto

Durante o desenvolvimento serão explorados:

## React

- Componentização;
- Props;
- Estados;
- Hooks;
- Renderização condicional;
- Organização de componentes.

## TypeScript

- Tipagem de componentes;
- Interfaces;
- Tipos personalizados;
- Segurança durante desenvolvimento.

## Comunicação em tempo real

- WebSocket;
- Socket.IO;
- Eventos cliente-servidor;
- Comunicação entre usuários.

## WebRTC

- Peer Connection;
- MediaStream;
- Compartilhamento de tela;
- Transmissão de áudio/vídeo.

---

# 🏗️ Arquitetura planejada

```text
                 Frontend
                    |
              React + TS
                    |
              Socket.IO
                    |
                 Backend
                    |
                 WebRTC
                    |
          Comunicação entre usuários
```

---

# 📌 Próximos passos

- [x] Implementar criação de salas;
- [ ] Adicionar conexão entre usuários;
- [ ] Integrar WebRTC;
- [ ] Implementar compartilhamento de tela;
- [ ] Melhorar experiência do usuário;
- [ ] Criar deploy da aplicação.

---

# 👩‍💻 Desenvolvido por

**Rafaela Chagas**

Projeto criado para estudo e evolução em desenvolvimento de aplicações modernas utilizando React, TypeScript e tecnologias de comunicação em tempo real.
