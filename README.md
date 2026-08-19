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