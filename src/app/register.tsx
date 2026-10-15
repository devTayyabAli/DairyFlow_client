import React from 'react';
import { router } from 'expo-router';

import { RegisterScreen } from '@/components/auth/RegisterScreen';

export default function RegisterPage() {
  return (
    <RegisterScreen
      onSuccess={() => {
        router.replace('/');
      }}
      onGoToLogin={() => {
        router.push('/login');
      }}
    />
  );
}
