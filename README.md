# 📊 MSL Monitor – Dashboard de Insights Sociais

- Um dashboard profissional para monitorar métricas orgânicas e pagas do Facebook e Instagram, com exportação de relatórios e visual moderno.

<img src="docs/screenshot-dashboard.png" width="800"/>
✨ Funcionalidades

Funcionalidades Diferenciais da Meta
Conexão direta com a Meta Graph API
Métricas 

✅ Conexão direta com a Meta Graph API
✅ Métricas orgânicas (Facebook e Instagram) e pagas (Ads)
✅ Gráficos interativos (linhas, pizza, comparativos)
✅ Cache inteligente para carregamento rápido
✅ Exportação de dados (CSV, PDF, Excel)
✅ Relatórios por período customizado
✅ Dark/Light mode
✅ Estrutura modular (backend em Flask + frontend em React)

🛠️ Tecnologias Utilizadas
Frontend

⚛️ React + Vite

📈 Recharts (gráficos)

🎨 Tailwind CSS (estilo moderno e responsivo)

Backend

🐍 Python + Flask

🔗 Integração com Meta Graph API

🌍 Flask-CORS

⚡ Cache em memória (TTL)

⚙️ Configuração
1. Clonar o projeto
git clone https://github.com/seuusuario/msl-monitor.git
cd msl-monitor

2. Configurar o Backend

Criar ambiente virtual e instalar dependências:

cd backend
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
.venv\Scripts\activate      # Windows

pip install -r requirements.txt


Copiar .env.example → .env e preencher:

META_GRAPH_VERSION=v23.0
META_SYSTEM_USER_TOKEN=SEU_TOKEN
META_APP_SECRET=SEU_SECRET
META_PAGE_ID=123456789
META_IG_USER_ID=123456789
META_AD_ACCOUNT_ID=act_123456


Banco de dados PostgreSQL:

1. Configure as variáveis `DATABASE_*` e `AUTH_SECRET_KEY` no arquivo `backend/.env` para apontar para o seu servidor Postgres (ou defina `DATABASE_URL` diretamente).
2. Execute o script `backend/sql/app_tables.sql` em seu banco para criar as tabelas `app_users`, `report_templates` e `reports` utilizadas pelo backend:
   ```
   psql "postgresql://usuario:senha@host:5432/monitor_db" -f backend/sql/app_tables.sql
   ```
3. Crie o primeiro usuário diretamente na tabela `app_users` ou usando o endpoint `/api/auth/register`. O backend utiliza o campo `role` para liberar o painel de administração (`analista` ou `admin`).
4. Para redefinir senhas existentes (ou criar usuários rapidamente) use o utilitário `backend/scripts/update_user_password.py`:
   ```
   cd backend
   python scripts/update_user_password.py usuario@empresa.com "NovaSenhaForte123"
   # ou crie um usuário admin caso ele ainda não exista
   python scripts/update_user_password.py admin@empresa.com "SenhaSecreta!" --nome "Administrador" --role admin --create
   ```
   O script aplica o mesmo algoritmo PBKDF2 usado pela API e atualiza o registro no Postgres automaticamente.


Rodar backend:

python server.py


Disponível em http://localhost:3001

3. Configurar o Frontend
cd my-app
npm install
cp .env.example .env # defina REACT_APP_API_URL=http://localhost:3001 (ou URL do backend)
npm run dev


# 🔗 Passo a passo para atualizar commits no Docker🔗 #

cd /root/DashboardSocial

 1) Salvar suas mudanças locais
git add -A
git commit -m "WIP: alterações locais no servidor"  # se houver algo a commitar
Se houver um merge inacabado:
git merge --abort 2>/dev/null || true

 2) Rebase com remoto
git pull

 (Se aparecer conflitos, edite os arquivos, git add <arquivo>, e continue)
 git rebase --continue

 3) Rebuildar e subir
docker compose build --pull
docker compose up -d
docker compose ps
