import { useAuth as useAuthFromContext } from '../context/AuthContext';

// Reexportar o hook useAuth do AuthContext
export const useAuth = useAuthFromContext;

export default useAuth; 