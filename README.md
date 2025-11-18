# Multi World Arcane (MWA)

## Descrição do Projeto
Este projeto é um jogo interativo que utiliza conceitos de eventos e componentes para criar uma experiência dinâmica. A arquitetura do projeto é baseada em um sistema de componentes, onde cada elemento do jogo (personagens, cenários, itens) é tratado como um componente independente. A interação entre esses componentes é gerenciada através de um sistema de eventos, permitindo uma comunicação desacoplada e flexível.

O jogo funciona da seguinte forma:
- **Componentes**: Cada entidade no jogo é composta por um ou mais componentes. Por exemplo, um personagem pode ter componentes de `Renderização`, `Movimento`, `Colisão` e `Inventário`.
- **Eventos**: As ações e interações no jogo são comunicadas através de eventos. Quando um componente realiza uma ação (ex: `personagem.move()`), ele emite um evento (`"playerMoved"`). Outros componentes interessados nesse evento podem "escutá-lo" e reagir de acordo (ex: o componente de `Câmera` pode seguir o personagem).
- **Ciclo de Vida**: Os componentes possuem um ciclo de vida bem definido (inicialização, atualização, destruição), o que facilita a gestão de recursos e a lógica do jogo.

## Instruções para Execução

Para executar este projeto localmente, siga os passos abaixo:

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/Glatharth/game-graphComp.git
    cd game-graphComp
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    # ou
    yarn install
    ```

3.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev
    # ou
    yarn dev
    ```

    O aplicativo estará disponível em `http://localhost:5173` (ou outra porta, dependendo da configuração).

## Vídeo de introdução do projeto
  <a href="https://www.youtube.com/watch?v=pd73fl_Glbk">
    <img src="https://img.youtube.com/vi/pd73fl_Glbk/0.jpg" alt="Vídeo de Introdução" width="560" height="315" style="border-radius: 8px;">
  </a>


## Créditos e Referências

### Bibliotecas Utilizadas
-   **Three.js**: Uma biblioteca JavaScript 3D de alto nível para exibir gráficos 3D acelerados por hardware na web.

### Modelos e Texturas
-   Texturas de planetas: [Solar System Scope Textures](https://www.solarsystemscope.com/textures/)
-   Assets diversos: [Kenney.nl](https://kenney.nl/)