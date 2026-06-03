import { useEffect } from 'react';
import styles from '../styles/Toast.module.css';

interface Props {
  message: string;
  onDismiss: () => void;
}

export default function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 2000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return <div className={styles.toast}>{message}</div>;
}
