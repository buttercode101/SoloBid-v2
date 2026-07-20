import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DollarSign, MessageSquare, TrendingUp } from 'lucide-react';
import { ONBOARDING_STEPS } from '../../constants';
import { setOnboardingComplete } from '../../services/storage';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const currentStep = ONBOARDING_STEPS[step];
  const isLastStep = step === ONBOARDING_STEPS.length - 1;

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'DollarSign':
        return DollarSign;
      case 'MessageSquare':
        return MessageSquare;
      case 'TrendingUp':
        return TrendingUp;
      default:
        return DollarSign;
    }
  };

  const IconComponent = getIconComponent(currentStep.icon);

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400';
      case 'emerald':
        return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400';
      case 'purple':
        return 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400';
    }
  };

  const handleNext = async () => {
    if (isLastStep) {
      await setOnboardingComplete();
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-800 rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl relative transition-colors"
      >
        <div className="h-1.5 w-full flex gap-1 px-8 sm:px-10 pt-8 sm:pt-10">
          {ONBOARDING_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-700 ${
                i <= step ? 'bg-blue-600' : 'bg-gray-100 dark:bg-slate-700'
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="p-8 sm:p-12 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className={`inline-flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 rounded-[28px] sm:rounded-[32px] mb-6 sm:mb-10 shadow-xl ${getColorClasses(
                  currentStep.color
                )}`}
                aria-hidden="true"
              >
                <IconComponent className="w-10 h-10 sm:w-14 sm:h-14" />
              </div>
              <h2
                id="onboarding-title"
                className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 leading-tight tracking-tight"
              >
                {currentStep.title}
              </h2>
              <p
                id="onboarding-description"
                className="text-blue-600 dark:text-blue-400 font-bold mb-6 sm:mb-8 uppercase tracking-widest text-[10px] sm:text-xs"
              >
                {currentStep.subtitle}
              </p>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-8 sm:mb-12 font-medium text-sm sm:text-base">
                {currentStep.description}
              </p>
            </motion.div>
          </AnimatePresence>
          <button
            onClick={handleNext}
            className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 sm:py-5 rounded-2xl font-black text-base sm:text-lg active:scale-95 transition-all shadow-2xl hover:bg-slate-800 dark:hover:bg-blue-700"
            aria-label={isLastStep ? 'Launch dashboard' : 'Next step'}
          >
            {isLastStep ? 'Launch Dashboard' : 'Next Step'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingFlow;
