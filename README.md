# IndieLisboa - Gestor de Stock (Web API)

Instituto Superior de Engenharia de Lisboa  
2021/2022 Semestre de Verão

Grupo 37

Alunos:
- Fábio Alexandre Pereira do Carmo - nº 39230
- Pedro Daniel Diz Pinela - nº 48084

Orientador:
- ISEL - Professor Nuno Leite

## Introdução

O presente projeto é apenas parte de um todo. Aqui encontra definida a componente da Web API que segue o padrão de arquitetura REST.

Secções: 
- [Instalação](#instalação) - Como instalar a aplicação. 
- [Estrutura da Aplicação](#estrutura-da-aplicação) - Organização dos ficheiros. 
- [Configuração](#configuração) - Descreve o ficheiro de configuração. 
- [Compilar, Executar e Testar](#compilar-executar-e-testar) - Descreve os comandos para iniciar a aplicação. 
- [Servidor HTTPS](#servidor-https) - Explica como correr o servidor para o protocolo HTTPS. 
- [Cross-Origin Resource Sharing](#cross-origin-resource-sharing-cors) - Notas sobre o mecanismo CORS.
- [Autenticação com conta Google](#autenticação-com-conta-google) - Descreve como utilizar a funcionalidade de autenticação com uma conta Google.
- [Documentação da Web API](#documentação-da-web-api) - Formas de obter a documentação das rotas da aplicação. 
- [Documentação Externa](#documentação-externa) - _Links_ para a documentação dos módulos NPM utilizados.

---

## Instalação

Esta aplicação é para correr no ambiente [NodeJS](https://nodejs.org/en/about/).

Na pasta raíz do projeto, execute o seguinte 