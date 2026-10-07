ADMIN
│
├── GET /api/admin/dashboard
│
├── USERS
│ ├── GET /api/admin/users
│ └── PATCH /api/admin/users/:id/status
│
├── LIBRARIANS
│ ├── POST /api/admin/librarians
│ ├── GET /api/admin/librarians
│ └── PATCH /api/admin/librarians/:id/status
│
├── RESERVATIONS
│ └── GET /api/admin/reservations
│
├── BORROWINGS
│ ├── GET /api/admin/borrowings
│ └── GET /api/admin/borrowings/overdue
│
└── PAYMENTS
└── GET /api/admin/payments
