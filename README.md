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

Na pasta raíz do projeto, execute o seguinte comando:
```
npm install
```
Este comando instala as dependências necessárias para compilar, executar e testar a aplicação.

---

## Estrutura da Aplicação

A organização geral é a seguinte: 
- `src/server.ts` - Servidor da aplicação que serve como ponto de entrada. 
- `src/sslcerts` - Diretório para os certificados do servidor (HTTPS). Mais detalhes na secção [Servidor HTTPS](#servidor-https)
- `src/app.ts` - Cria a aplicação (_middlewares_, rotas, etc). 
- `src/routes.ts` - Gerado automaticamente pela framework TSOA. Regista as rotas da aplicação. 
- `src/config.json` - Contém os parâmetros de configuração da aplicação. 
- `src/openapi.json` - Gerado automaticamente pela framework TSOA. Contém a especificação OpenAPI para