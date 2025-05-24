// src/components/common/ClientOnlyToastContainer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ToastContainer, ToastContainerProps } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ClientOnlyToastContainer = (props: ToastContainerProps) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null; // Don't render anything on the server or before mount
  }

  return <ToastContainer {...props} />;
};

export default ClientOnlyToastContainer;