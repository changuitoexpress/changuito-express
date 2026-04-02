/* DO NOT TRANSLATE THIS FILE */
import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ErrorConexionProps {
  mensaje?: string;
  onReintentar?: () => void;
}

export default function ErrorConexion(props: ErrorConexionProps) {
  const mensaje = props.mensaje ?? 'No se pudo conectar con el servidor.';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020617',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(248,113,113,0.25)',
        borderRadius: '24px',
        padding: '40px 32px',
        maxWidth: '360px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>

        <div style={{
          width: '64px', height: '64px', borderRadius: '20px',
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <WifiOff style={{ width: '28px', height: '28px', color: '#f87171' }} />
        </div>

        <p style={{
          fontSize: '10px', letterSpacing: '0.35em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.25)', fontWeight: 700, margin: '0 0 8px 0',
        }}>
          Error de Conexión
        </p>

        <h2 style={{
          fontSize: '18px', fontWeight: 900, color: '#f87171',
          margin: '0 0 12px 0', letterSpacing: '-0.02em',
        }}>
          Sin conexión
        </h2>

        <p style={{
          fontSize: '13px', color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.6, margin: '0 0 28px 0',
        }}>
          {mensaje}
        </p>

        {props.onReintentar && (
          <button
            onClick={props.onReintentar}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: '#facc15', color: '#020617', fontWeight: 900,
              fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em',
              padding: '12px 24px', borderRadius: '12px', border: 'none',
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(250,204,21,0.25)',
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px' }} />
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}