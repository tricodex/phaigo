import React from 'react';
import Image from 'next/image';

interface PyusdIconProps {
  className?: string;
  size?: number;
}

const PyusdIcon: React.FC<PyusdIconProps> = ({ className = '', size = 20 }) => {
  return (
    <Image
      src="/pyusd-blue.svg"
      alt="PYUSD"
      width={size}
      height={size}
      className={className}
    />
  );
};

export default PyusdIcon; 