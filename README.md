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

- [x] Criação de salas privadas com código gerado pelo servidor;
- [x] Entrada por código ou link, até 8 pessoas por sala;
- [x] Chamadas de áudio e vídeo com WebRTC;
- [x] Compartilhamento de tela, com áudio quando o navegador permite;
- [x] Controle de microfone e câmera, com escolha de dispositivos;
- [x] Indicador de quem está falando e sons de entrada, saída e mudo;
- [x] Ensurdecer, volume individual e apertar para falar;
- [x] Escolha de resolução e taxa de quadros da tela;
- [x] Chat de texto com respostas, reações, imagens e aviso de digitação;
- [x] Lista de participantes, com remoção feita pelo anfitrião;
- [x] Reconexão automática sem perder o lugar na sala;
- [x] Suporte a STUN/TURN por configuração;
- [x] Layout responsivo.

---

# 🛠️ Tecnologias utilizadas

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide React

## Backend

- Node.js
- Express
- Socket.IO

## Comunicação em tempo real

- WebRTC
- WebSocket
- STUN/TURN

---

# 📂 Estrutura do projeto

```bash
server
├── app.ts          # Rotas HTTP e eventos do Socket.IO
├── chat.ts         # Mensagens, reações e imagens do chat
├── rooms.ts        # Regras das salas e dos participantes
├── index.ts        # Configuração e inicialização
└── app.test.ts

src
├── components
│   ├── CallControls
│   ├── Chat
│   ├── Dialogs
│   ├── Header
│   ├── Media
│   ├── Participants
│   ├── ScreenShare
│   ├── Sidebar
│   └── Stage
│
├── hooks
│   ├── useMediaQuery.ts
│   └── useRoom.ts
│
├── pages
│   ├── HomePage.tsx
│   ├── NotFoundPage.tsx
│   └── RoomPage.tsx
│
├── routes
│   └── index.tsx
│
├── services
│   ├── audioContext.ts
│   ├── chatImage.ts   # Redução das imagens antes do envio
│   ├── preferences.ts # Dispositivos e opções salvas no navegador
│   ├── roomClient.ts  # Ciclo de vida da chamada
│   ├── socket.ts      # Conexão com o servidor
│   ├── sounds.ts      # Sons da chamada
│   ├── speaking.ts    # Detecção de quem está falando
│   ├── userName.ts
│   └── webrtc.ts      # Conexões entre participantes
│
├── types              # Tipos usados pelo cliente e pelo servidor
│
├── App.tsx
└── main.tsx
```

---

#  ⚙️ Como executar o projeto

## Pré-requisitos

Antes de iniciar, tenha instalado:

- Node.js
- npm ou yarn

---

## Instalação

Clone o repositório:

```bash
git clone https://github.com/Harunookami/roomly-call.git
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

O comando inicia o frontend e o servidor (porta 3001) juntos.

## Testes

```bash
npm test
```

---

# 🚀 Deploy

Em produção, um único processo Node serve a interface e o Socket.IO:

```bash
npm run build
npm start
```

Também é possível usar o `Dockerfile`. As variáveis de ambiente estão em `.env.example`; defina-as no ambiente de hospedagem.

- **HTTPS é obrigatório:** fora do `localhost`, o navegador só libera microfone, câmera e tela em HTTPS. Isso também vale para testes pela rede local.
- **Configure um servidor TURN:** só com STUN, pessoas em redes restritivas (empresas, 4G) podem não conseguir se conectar.
- **Rode uma única instância:** as salas, as mensagens e as imagens do chat ficam na memória do servidor. Elas se perdem quando ele reinicia ou quando a sala fica vazia por um minuto.

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

# 🏗️ Arquitetura

```text
  Navegador A  <----- áudio, vídeo e tela (WebRTC) ----->  Navegador B
       |                                                        |
       +------------ Socket.IO ---- Servidor ---- Socket.IO ----+
                   (salas, participantes e sinalização)
```

A mídia vai diretamente entre os navegadores, em malha: cada participante mantém uma conexão com cada um dos outros. O servidor organiza as salas, repassa as mensagens que abrem essas conexões e guarda o chat. Como cada pessoa envia sua mídia para todas as outras, as salas são limitadas a 8 pessoas.

---

# 👩‍💻 Desenvolvido por

**Rafaela Chagas**

Projeto criado para estudo e evolução em desenvolvimento de aplicações modernas utilizando React, TypeScript e tecnologias de comunicação em tempo real.