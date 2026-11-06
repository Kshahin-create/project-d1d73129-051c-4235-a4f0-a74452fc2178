import {Header} from '@/components/Header';
import {TaskList} from '@/components/tasks/TaskList';
import {useAuth} from '@/hooks/useAuth';
import {Navigate,Link} from 'react-router-dom';
import {Button} from '@/components/ui/button';
export default function MyTasks(){const auth=useAuth();if(auth.loading)return null;if(!auth.user)return <Navigate to="/auth" replace/>;return <><Header/><main className="container-tight space-y-6 py-8" dir="rtl"><div className="flex gap-3"><Button asChild variant="outline"><Link to="/admin/followup">متابعة الفريق</Link></Button>{auth.isAdmin&&<Button asChild variant="outline"><Link to="/admin/settings/tasks">إعدادات المهام</Link></Button>}</div><TaskList/></main></>;}