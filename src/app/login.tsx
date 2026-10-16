import React from 'react';
import { router } from 'expo-router';

import { LoginScreen } from '@/components/auth/LoginScreen';

export default function LoginPage() {
  return (
    <LoginScreen
      onSuccess={() => {
        router.replace('/');
      }}
    />
  );
}
