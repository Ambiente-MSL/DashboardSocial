Premissas (arquitetura em camadas)

AppShell único (global)

Não existe mais sidebar.

Sempre renderiza uma Topbar global escura.

A Topbar é configurável por rota via setTopbarConfig(...) (chips de período, date-range, seletor de conta, avatar etc.).

Página (Instagram, Facebook, etc.)

Não renderiza outra Topbar.

Usa setTopbarConfig no useEffect para empurrar as ações/controles para a Topbar global.

Renderiza o “hero de navegação” (Instagram | Facebook | Ads | Relatórios | Admin | Configurações) logo abaixo da Topbar, como nas imagens de referência (fundo branco, cards e gráficos).

Estilos

Layout sem espaço reservado do sidebar (remover paddings/margens que existiam para ele).

Topbar com alinhamento à direita para chips, datepicker e seletor de contas.

Grid/cards/brancos seguindo as referências (você já está próximo).

O erro do agente: ele escondeu a topbar global (setTopbarConfig({ hidden: true })) e às vezes não montou a Topbar local na página (ou montou com CSS/z-index que não aparecia). Resultado: ficou sem topbar nenhuma. Além disso, há dois useEffect duplicados escondendo a topbar dentro do InstagramDashboard.jsx.