import { PermissionsWorkspace } from '@/components/admin/PermissionsWorkspace';
import { Header } from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
export default function PermissionsGuide(){const auth=useAuth();if(auth.loading)return null;if(!auth.user)return <Navigate to="/auth" replace/>;return <><Header/><main className="mx-auto max-w-5xl px-5 py-7"><PermissionsWorkspace readOnly/></main></>;}