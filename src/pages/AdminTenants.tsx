import { Navigate } from "react-router-dom";

// Old per-row tenant view replaced by consolidated tenant_accounts page.
const AdminTenants = () => <Navigate to="/admin/tenant-accounts" replace />;
export default AdminTenants;
