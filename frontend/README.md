# DataHub Pro Frontend

A complete React SaaS analytics platform frontend for SMEs. Users can upload Excel files, access AI-powered analytics dashboards, manage team billing, and more.

## Directory Structure

```
frontend/
├── index.html                    # HTML entry point
├── package.json                  # Dependencies & scripts
├── vite.config.js               # Vite configuration with API proxy
├── src/
│   ├── main.jsx                 # React app bootstrap with Toaster
│   ├── index.css                # Global styles with CSS variables
│   ├── api.js                   # Axios client with auth/error interceptors
│   ├── App.jsx                  # Route definitions and auth guards
│   ├── context/
│   │   └── AuthContext.jsx      # User auth state & localStorage
│   ├── components/
│   │   └── Layout.jsx           # Sidebar + top bar + main content wrapper
│   └── pages/
│       ├── LandingPage.jsx      # Public homepage with hero, features, pricing
│       ├── Login.jsx            # Login form
│       ├── Register.jsx         # Sign-up form with org name
│       ├── Dashboard.jsx        # Welcome, stats, recent files, trial banner
│       ├── Files.jsx            # File manager with drag-drop upload
│       ├── Analytics.jsx        # iFrame embed of datahub-pro.html
│       ├── Billing.jsx          # Subscription plans & Stripe checkout
│       ├── Team.jsx             # Team members table + invite form
│       └── Settings.jsx         # Profile & password change
```

## Brand & Colours

- **Primary (Navy)**: `#0c1446`
- **Accent (Magenta)**: `#e91e8c`
- **Cyan**: `#0097b2`
- **Green**: `#10b981`
- **Font**: System sans-serif

## Installation & Development

```bash
# Install dependencies
npm install

# Start dev server on http://localhost:3000
npm run dev

# Build for production
npm build

# Preview production build
npm preview
```

The dev server proxies `/api/*` requests to `http://localhost:8000`.

## Key Features

### Authentication (`src/api.js`, `src/context/AuthContext.jsx`)
- JWT token-based auth stored in localStorage
- Automatic token attachment to all API requests
- Auto-redirect to login on 401 errors
- Login/register forms with validation

### File Management (`src/pages/Files.jsx`)
- Drag-and-drop file upload
- Support for .xlsx, .xls, .csv files
- File deletion with confirmation
- File metadata display (rows, columns, size, date)
- Direct navigation to analytics for any file

### Analytics (`src/pages/Analytics.jsx`)
- Embedded HTML iframe for the analytics tool (`/analytics-tool/datahub-pro.html`)
- Clean full-screen experience within React app

### Billing (`src/pages/Billing.jsx`)
- Display available subscription plans (Starter, Growth, Enterprise)
- Stripe checkout integration
- Current plan indicator
- Billing portal access for paid subscribers

### Team Management (`src/pages/Team.jsx`)
- View all workspace members with roles
- Invite new team members with role assignment (owner, admin, member, viewer)
- Last login and join dates

### Dashboard (`src/pages/Dashboard.jsx`)
- Quick stat cards (files, total rows, plan, team members)
- Trial status banner with upgrade CTA
- Recent files table
- Quick action cards to upload files or open analytics

### Settings (`src/pages/Settings.jsx`)
- View profile information (read-only)
- Change password with validation
- Role-based access control for invitation

## API Integration

All API calls use the `api` client from `src/api.js` which handles:
- Bearer token attachment
- 401 error handling with auto-logout
- Multipart form data for file uploads

### Available Endpoints (via `/api`)
- **Auth**: `/auth/register`, `/auth/login`, `/auth/me`, `/auth/change-password`
- **Files**: `/files/`, `/files/upload`, `/files/{id}/download`, `/files/{id}`
- **Analytics**: `/analytics/summary/{fileId}`, `/analytics/kpi/{fileId}`
- **Billing**: `/billing/plans`, `/billing/create-checkout`, `/billing/portal`, `/billing/cancel`
- **Users**: `/users/team`, `/users/invite`, `/users/audit-log`

## Styling

- No Tailwind CSS (kept lightweight)
- Pure CSS with CSS variables in `:root`
- Inline styles for component-specific styling
- Class-based utilities for buttons and cards

## Production Deployment

1. Build the app: `npm run build`
2. Serve the `dist/` folder as static files
3. Configure your reverse proxy/API gateway to proxy `/api/*` requests
4. Ensure `/analytics-tool/datahub-pro.html` is served from the same origin or configured CORS

## Security Notes

- Never commit `.env` files with API keys
- Tokens stored in localStorage (consider sessionStorage for sensitive environments)
- CORS configuration required on the backend
- Stripe integration expects checkout URLs in responses
- Consider CSRF tokens if form submissions bypass Axios

## Browser Support

Modern browsers supporting ES6+ (Chrome, Firefox, Safari, Edge).

## Development Notes

- Uses React Router v6 for client-side routing
- react-hot-toast for notifications
- Axios for HTTP requests
- Responsive grid layouts for multi-screen support
- Accessibility: semantic HTML, proper heading hierarchy, form labels

---

Built with React 18 + Vite. A complete SaaS frontend wrapper for enterprise analytics.
