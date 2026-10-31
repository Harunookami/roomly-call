# 🎥 Roomly

> Aplicação web de chamadas privadas com compartilhamento de tela em tempo real.

O **Roomly** é um projeto desenvolvido com o objetivo de criar uma experiência simples de comunicação entre poucas pessoas: uma única sala privada, protegida por senha, para fazer chamadas, compartilhar a tela e conversar por texto.

O projeto busca explorar conceitos de **aplicações em tempo real**, comunicação cliente-servidor e tecnologias utilizadas em ferramentas como Discord, Google Meet e Microsoft Teams.

---

## 🚀 Objetivo do projeto

Construir uma aplicação de chamadas onde usuários possam:

- Entrar na sala privada com uma senha;
- Conversar em tempo real;
- Compartilhar a tela;
- Trocar mensagens que ficam salvas;
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

- [x] Sala única e fixa, com até 8 pessoas;
- [x] Acesso por senha, lembrado em cada aparelho;
- [x] Chamadas de áudio e vídeo com WebRTC;
- [x] Compartilhamento de tela, com áudio quando o navegador permite;
- [x] Controle de microfone e câmera, com escolha de dispositivos;
- [x] Indicador de quem está falando e sons de entrada, saída e mudo;
- [x] Ensurdecer, volume individual e apertar para falar;
- [x] Escolha de resolução e taxa de quadros da tela;
- [x] Chat de texto salvo, com respostas, reações, imagens e aviso de digitação;
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
- SQLite (módulo `node:sqlite`, exige Node.js 24)

## Comunicação em tempo real

- WebRTC
- WebSocket
- STUN/TURN

---

# 📂 Estrutura do projeto

```bash
server
├── app.ts          # Rotas HTTP e eventos do Socket.IO
├── auth.ts         # Senha de acesso e sessão
├── chat.ts         # Mensagens, reações e imagens salvas em disco
├── rooms.ts        # Regras da sala e dos participantes
├── index.ts        # Configuração e inicialização
└── app.test.ts

src
├── components
│   ├── CallControls
│   ├── Chat
│   ├── Dialogs
│   ├── Entry
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
│   ├── session.ts     # Login e verificação da sessão
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

- Node.js 24 ou mais recente
- npm

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

O comando inicia o frontend e o servidor (porta 3001) juntos. Em desenvolvimento, a senha da sala é `roomly`, e a conversa fica na pasta `data`, que não vai para o Git.

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

- **Defina `ROOMLY_PASSWORD`:** sem ela, o servidor não inicia. Use uma senha longa, porque ela é a única proteção da sala.
- **Use um disco persistente:** aponte `DATA_DIR` para ele. Sem isso, a conversa e as imagens somem a cada novo deploy.
- **Faça backup da pasta de dados:** ela guarda toda a conversa, sem criptografia.
- **HTTPS é obrigatório:** fora do `localhost`, o navegador só libera microfone, câmera e tela em HTTPS. Isso também vale para testes pela rede local.
- **Configure um servidor TURN:** só com STUN, pessoas em redes restritivas (empresas, 4G) podem não conseguir se conectar.
- **Rode uma única instância:** quem está na chamada fica na memória do servidor. Depois de um reinício, os aparelhos voltam sozinhos.

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
                  (sala, participantes, sinalização e chat)
```

A mídia vai diretamente entre os navegadores, em malha: cada participante mantém uma conexão com cada um dos outros. O servidor controla o acesso, repassa as mensagens que abrem essas conexões e guarda o chat. Quando a conexão direta não é possível, a mídia passa pelo servidor TURN. Como cada pessoa envia sua mídia para todas as outras, a sala é limitada a 8 pessoas.

---

# 👩‍💻 Desenvolvido por

**Rafaela Chagas**

Projeto criado para estudo e evolução em desenvolvimento de aplicações modernas utilizando React, TypeScript e tecnologias de comunicação em tempo real.