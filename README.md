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
- `src/openapi.json` - Gerado automaticamente pela framework TSOA. Contém a especificação OpenAPI para as rotas desta aplicação. 
- `src/sequelize.ts` - Cria a instância para a interação com a base de dados. 
- `src/common/errors.ts` - Processamento de erros da aplicação. 
- `src/common/roles.ts` - Define os níveis de privilégio para as rotas da aplicação. 
- `src/common/types.ts` - Define os tipos e interfaces em comum entres as entidades de domínio.
- `src/security/authorization.ts` - Controlo de autenticação e autorização.
- `src/utils/crypto.ts` - Contém funções de criptografia. 
- `src/utils/logger.ts` - Para registar os pedidos HTTP, interação com a base de dados e outros _logs_.

Cada entidade de domínio (e.g. product), tem a seguinte estrutura:
- `src/{entity}/{entity}Controller.ts` - Implementa o controlador TSOA. Aqui encontra a definição das rotas para essa entidade.
- `src/{entity}/{entity}Model.ts` - Implementa o modelo Sequelize.

---

## Configuração

No ficheio `src/config.json`, estão definidos os parâmetros de configuração da aplicação. Os que têm o nome capitalizado (e.g. sequelize.DATABASE_URL) também podem ser definidos como variável de ambiente. Se definida, a aplicação dá prioridade à variável de ambiente.  
**Nota:  Por uma questão de segurança, recomenda-se o uso das variáveis de ambiente, em particular com informação sensível.**

Os parâmetros de configuração são os seguintes: 
- `sequelize.DATABASE_URL` - URL do servidor da base de dados. 
- `sequelize.options` - Objecto com as opções da ligação do [Sequelize](https://sequelize