# Documentation

| Topic | Document |
|---|---|
| How IROAS and URY fit together (one app, one URY site per restaurant) | [architecture/multi-tenant-ury.md](architecture/multi-tenant-ury.md) |
| Frontend and backend structure | [architecture/frontend-backend.md](architecture/frontend-backend.md) |
| Deploying the IROAS app to a server | [architecture/deploy.md](architecture/deploy.md) |
| URY server, local patch, provisioning | [../ury/README.md](../ury/README.md) |
| URY API: what works, what is missing | [ury/URY_API_STATUS.md](ury/URY_API_STATUS.md) |
| URY API: full function-level reference | [ury/URY_API_REFERENCE.md](ury/URY_API_REFERENCE.md) |
| URY API: endpoint contracts found by discovery | [ury/URY_API_DISCOVERY.md](ury/URY_API_DISCOVERY.md) |
| URY menu and tables discovery | [ury/URY_MENU_API_DISCOVERY.md](ury/URY_MENU_API_DISCOVERY.md) |
| URY owns restaurant operations: gap analysis and plan | [ury/URY_PLAN_B_GAP_ANALYSIS.md](ury/URY_PLAN_B_GAP_ANALYSIS.md) |
| Raw network-capture inventories | [ury/discovery/](ury/discovery/) |

## Architecture decisions

| ADR | Decision |
|---|---|
| [0001](adr/0001-one-iroas-app-one-ury-site-per-customer.md) | One IROAS app, one URY site per customer |
| [0002](adr/0002-sqlite-for-the-iroas-app-until-after-pilot.md) | SQLite for the IROAS app until after the pilot |
| [0003](adr/0003-keep-repo-layout-until-clean-install.md) | Keep `src/` + `server/` layout until the M5 clean install |
