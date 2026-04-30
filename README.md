# Juliana Balbino — Blog

Blog estático sobre **moda, bem-estar e qualidade de vida**, com formulário de contato/inscrição que coleta informações dos leitores.

## Funcionalidades

- 🏠 **Página inicial** com hero, chamada e últimas postagens
- 👗 **Categorias**: Moda, Bem-estar e Qualidade de Vida
- 📝 **Posts** completos de exemplo em cada categoria
- 📩 **Formulário de contato** que coleta: nome, e-mail, idade, cidade, interesses, mensagem, opt-in de newsletter e consentimento
- 🛠️ **Painel `admin.html`** que lista todas as inscrições recebidas, permite **exportar em JSON** e apagar os registros
- 💾 Os envios do formulário são armazenados no `localStorage` do navegador (demonstração — sem backend)
- 📱 Layout **responsivo**, com tipografia elegante (Playfair Display + Inter) e paleta rosé

## Estrutura

```
.
├── index.html              # Home
├── moda.html               # Categoria Moda
├── bem-estar.html          # Categoria Bem-estar
├── qualidade-vida.html     # Categoria Qualidade de Vida
├── contato.html            # Formulário de inscrição
├── admin.html              # Painel de inscrições recebidas
├── posts/
│   ├── moda-outono-2026.html
│   ├── meditacao-iniciantes.html
│   └── sono-qualidade.html
├── css/styles.css
└── js/
    ├── main.js             # Navegação ativa, ano do rodapé
    └── form.js             # Validação, submissão e painel admin
```

## Como executar

Por ser um site estático (HTML + CSS + JavaScript puro), basta abrir o `index.html` no navegador.
Para uma melhor experiência (caminhos relativos, fontes, etc.) recomenda-se servir localmente:

```bash
# Python 3
python3 -m http.server 8000

# ou Node
npx serve .
```

Depois, acesse `http://localhost:8000`.

## Observações sobre privacidade

Os dados enviados pelo formulário ficam **apenas no navegador do usuário** (`localStorage`),
para fins de demonstração. Para produção, integre o `submit` do formulário a um backend ou
serviço como Formspree, Netlify Forms, Google Forms, etc.
