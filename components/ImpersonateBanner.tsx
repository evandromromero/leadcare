import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';

interface ImpersonateBannerProps {
  clinicName: string;
  onExit: () => void;
}

const ImpersonateBanner: React.FC<ImpersonateBannerProps> = ({ clinicName, onExit }) => {
  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Eye className="w-5 h-5" />
        <span className="font-medium">
          Visualizando como: <strong>{clinicName}</strong>
        </span>
      </div>
      <button
        onClick={onExit}
        className="flex items-center gap-2 px-4 py-1.5 bg-white text-amber-600 rounded-lg font-medium hover:bg-amber-50 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar ao Admin
      </button>
    </div>
  );
};

export default ImpersonateBanner;
