# MedAlo

Aplicativo móvel de gestão e alerta de medicamentos desenvolvido com foco na acessibilidade digital e usabilidade para o público idoso. Este projeto é um Trabalho de Conclusão de Curso do Instituto Federal do Rio Grande do Norte.

## Sobre o Projeto

O MedAlo foi construído para resolver o problema da adesão medicamentosa pelo público idoso, combatendo as barreiras tecnológicas dos aplicativos convencionais. O sistema opera de forma totalmente *offline*, dispensando a criação de contas em nuvem ou conexão com a internet para suas funcionalidades principais.

Para contornar o problema de alertas ignorados, o aplicativo substitui as notificações padrão do sistema operacional por um alerta em tela cheia que simula uma chamada telefônica, reduzindo a curva de aprendizado do usuário idoso.

## Funcionalidades Principais

* **Funcionamento 100% Offline:** Dados salvos localmente utilizando o banco de dados SQLite.
* **Interface Acessível:** Design focado na redução da carga cognitiva, com formulários de etapa única, fontes ampliadas e suporte a modo escuro de alto contraste.
* **Alertas de Alta Prioridade:** Tela emergente que simula uma ligação telefônica (botões de atender e desligar).
* **TTS:** Verbalização do nome e da dosagem do medicamento durante o acionamento do alarme.

## Tecnologias Utilizadas

* **React Native**
* **Expo**
* **SQLite**
* **Notifee**
* **Expo Speech**
* **Expo AV**

## Como Executar o Projeto

### Pré-requisitos

* Node.js instalado
* Conta e CLI do Expo configurados
* Dispositivo físico Android

### Passos de Instalação

1. Clone este repositório:
```bash
git clone https://github.com/SoulsXD/app-lembrete-idosos.git
```

2. Acesse a pasta do projeto.

3. Instale as dependências:
```bash
npm install
```

4. Inicie o servidor de desenvolvimento:
```bash
npx expo start
```

### Gerando o APK para testes

Recomenda-se a geração do APK via EAS Build:

```bash
eas build -p android --profile preview
```

## Autor

**Marcelo Henrique Cordeiro e Souza**  
Tecnologia em Sistemas para Internet - IFRN Campus Parnamirim
