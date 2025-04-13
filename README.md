# RunCash

## Segurança na Autenticação

O sistema agora implementa uma camada aprimorada de segurança utilizando cookies HttpOnly para armazenar tokens de autenticação. Esta abordagem oferece proteção significativa contra ataques de Cross-Site Scripting (XSS) quando comparada ao armazenamento em localStorage.

### Características de segurança:

- **Cookies HttpOnly**: Impede acesso via JavaScript, protegendo contra ataques XSS
- **Cookies com flag Secure**: Transmitidos apenas via HTTPS (em ambiente de produção)
- **Cookies com SameSite=Strict**: Proteção contra ataques CSRF
- **Autenticação híbrida**: Suporta tanto cookies quanto tokens no cabeçalho de autorização

### Considerações técnicas:

- O frontend utiliza a biblioteca js-cookie para gerenciar cookies do lado cliente
- O backend configura cookies HttpOnly quando solicitado
- O sistema funciona mesmo quando cookies são bloqueados, revertendo para o método tradicional de autenticação 