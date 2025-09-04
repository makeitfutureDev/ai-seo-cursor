/*
  # Add flags to countries table

  1. Changes
    - Add flag column to countries table
    - Populate all countries with their respective flag emojis

  2. Security
    - No changes to RLS policies needed
*/

-- Add flag column to countries table
ALTER TABLE countries ADD COLUMN IF NOT EXISTS flag text;

-- Update countries with their flag emojis
UPDATE countries SET flag = '🇺🇸' WHERE code = 'US';
UPDATE countries SET flag = '🇬🇧' WHERE code = 'GB';
UPDATE countries SET flag = '🇨🇦' WHERE code = 'CA';
UPDATE countries SET flag = '🇦🇺' WHERE code = 'AU';
UPDATE countries SET flag = '🇩🇪' WHERE code = 'DE';
UPDATE countries SET flag = '🇫🇷' WHERE code = 'FR';
UPDATE countries SET flag = '🇮🇹' WHERE code = 'IT';
UPDATE countries SET flag = '🇪🇸' WHERE code = 'ES';
UPDATE countries SET flag = '🇳🇱' WHERE code = 'NL';
UPDATE countries SET flag = '🇧🇪' WHERE code = 'BE';
UPDATE countries SET flag = '🇨🇭' WHERE code = 'CH';
UPDATE countries SET flag = '🇦🇹' WHERE code = 'AT';
UPDATE countries SET flag = '🇸🇪' WHERE code = 'SE';
UPDATE countries SET flag = '🇳🇴' WHERE code = 'NO';
UPDATE countries SET flag = '🇩🇰' WHERE code = 'DK';
UPDATE countries SET flag = '🇫🇮' WHERE code = 'FI';
UPDATE countries SET flag = '🇵🇱' WHERE code = 'PL';
UPDATE countries SET flag = '🇨🇿' WHERE code = 'CZ';
UPDATE countries SET flag = '🇭🇺' WHERE code = 'HU';
UPDATE countries SET flag = '🇷🇴' WHERE code = 'RO';
UPDATE countries SET flag = '🇧🇬' WHERE code = 'BG';
UPDATE countries SET flag = '🇬🇷' WHERE code = 'GR';
UPDATE countries SET flag = '🇵🇹' WHERE code = 'PT';
UPDATE countries SET flag = '🇮🇪' WHERE code = 'IE';
UPDATE countries SET flag = '🇱🇺' WHERE code = 'LU';
UPDATE countries SET flag = '🇮🇸' WHERE code = 'IS';
UPDATE countries SET flag = '🇲🇹' WHERE code = 'MT';
UPDATE countries SET flag = '🇨🇾' WHERE code = 'CY';
UPDATE countries SET flag = '🇪🇪' WHERE code = 'EE';
UPDATE countries SET flag = '🇱🇻' WHERE code = 'LV';
UPDATE countries SET flag = '🇱🇹' WHERE code = 'LT';
UPDATE countries SET flag = '🇸🇰' WHERE code = 'SK';
UPDATE countries SET flag = '🇸🇮' WHERE code = 'SI';
UPDATE countries SET flag = '🇭🇷' WHERE code = 'HR';
UPDATE countries SET flag = '🇷🇸' WHERE code = 'RS';
UPDATE countries SET flag = '🇧🇦' WHERE code = 'BA';
UPDATE countries SET flag = '🇲🇪' WHERE code = 'ME';
UPDATE countries SET flag = '🇲🇰' WHERE code = 'MK';
UPDATE countries SET flag = '🇦🇱' WHERE code = 'AL';
UPDATE countries SET flag = '🇯🇵' WHERE code = 'JP';
UPDATE countries SET flag = '🇰🇷' WHERE code = 'KR';
UPDATE countries SET flag = '🇨🇳' WHERE code = 'CN';
UPDATE countries SET flag = '🇮🇳' WHERE code = 'IN';
UPDATE countries SET flag = '🇧🇷' WHERE code = 'BR';
UPDATE countries SET flag = '🇲🇽' WHERE code = 'MX';