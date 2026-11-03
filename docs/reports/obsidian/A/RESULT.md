# Этап A — проверен
Полное новое ТЗ прочитано: ../APPROVED_SPEC.md. Утверждён B; повторный дизайн не проводится.
AppShell, Sidebar, PageHeader, BentoPanel, MetricCard, ChartPanel, DataTable (виртуализация), ContextDrawer, StatusBadge, ProgressRing, EmptyState и NotificationToast вынесены в design/. Подключён Tailwind без preflight, чтобы сохранить CSS утверждённой Home. Новая палитра доступна на всех страницах, задачи открываются в контекстной панели.
38 unit/integration, TypeScript strict, ESLint, build — passed. 12 реальных Electron снимков demo/empty × Home/Tasks/Study × 1366/1920. Home B: 0 изменённых пикселей относительно утверждённых изображений в обоих разрешениях. SQLite на этапе A не изменялась.
Windows runtime не выполнялся. Полное ТЗ A–F ещё не завершено; функциональные пробелы переносятся в B–F, а не объявляются готовыми.
