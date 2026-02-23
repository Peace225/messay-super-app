import QRCode from 'qrcode';

/**
 * Génère un QR code en base64
 */
export const generateQRCode = async (data: string): Promise<string> => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
    });
    return qrCodeDataURL;
  } catch (error) {
    throw new Error('Erreur lors de la génération du QR code');
  }
};

/**
 * Génère un identifiant unique pour QR code
 */
export const generateQRCodeId = (prefix: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};
