import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface FrostedLoadingScreenProps {
  isLoading?: boolean;
}

export const FrostedLoadingScreen: React.FC<FrostedLoadingScreenProps> = () => {
  const [showGradewell, setShowGradewell] = useState(true);
  const [isBlackOpening, setIsBlackOpening] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // 1. Show Gradewell Gradebook screen first for 1.5 seconds
    const timer1 = setTimeout(() => {
      // Instantly remove Gradewell screen & start black aperture transition
      setShowGradewell(false);
      setIsBlackOpening(true);
    }, 1500);

    // 2. Complete black transition and unmount
    const timer2 = setTimeout(() => {
      setIsDone(true);
    }, 2300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  if (isDone) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden select-none pointer-events-none font-sans text-slate-800">
      {/* 1. SOLID GRADEWELL GRADEBOOK SCREEN (Respects dark mode; black/dark background in dark mode) */}
      {showGradewell && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 p-6 sm:p-12 pointer-events-auto transition-colors">
          {/* Top Navigation */}
          <header className="w-full max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-md shadow-blue-600/20">
                  G
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">Gradewell</span>
              </div>
              <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-400">
                <span>Gradebook</span>
                <span>Attendance</span>
                <span>Reports</span>
                <span>Pricing</span>
              </nav>
            </div>
            <div>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Sign in</span>
            </div>
          </header>

          {/* Main Hero & Biology Card Section */}
          <main className="w-full max-w-7xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-8">
            {/* Left Column Text */}
            <div className="lg:col-span-6 space-y-6">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                GRADEBOOK FOR TEACHERS
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] font-heading">
                Grading that keeps up with your classroom.
              </h1>
              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-lg font-normal leading-relaxed">
                Track assignments, attendance and progress in one place, and share reports with students and families.
              </p>
              <div>
                <button
                  type="button"
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-colors"
                >
                  Start free trial
                </button>
              </div>
            </div>

            {/* Right Column Floating Card */}
            <div className="lg:col-span-6 flex justify-center lg:justify-end">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-2xl border border-slate-100/80 dark:border-slate-800">
                <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white text-base">Period 3 · Biology</span>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Fall term</span>
                </div>

                <div className="pt-4 space-y-4">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <span className="col-span-6">STUDENT</span>
                    <span className="col-span-2 text-center">QUIZ</span>
                    <span className="col-span-2 text-center">LAB</span>
                    <span className="col-span-2 text-right">AVG</span>
                  </div>

                  {/* Student Rows */}
                  <div className="space-y-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <div className="grid grid-cols-12 items-center">
                      <span className="col-span-6 text-slate-900 dark:text-white font-bold">Amara Okafor</span>
                      <span className="col-span-2 text-center text-slate-500 dark:text-slate-400">92</span>
                      <span className="col-span-2 text-center text-slate-500 dark:text-slate-400">88</span>
                      <span className="col-span-2 text-right font-black text-blue-600 dark:text-blue-400">A-</span>
                    </div>
                    <div className="grid grid-cols-12 items-center">
                      <span className="col-span-6 text-slate-900 dark:text-white font-bold">Ben Hartley</span>
                      <span className="col-span-2 text-center text-slate-500 dark:text-slate-400">81</span>
                      <span className="col-span-2 text-center text-slate-500 dark:text-slate-400">85</span>
                      <span className="col-span-2 text-right font-black text-blue-600 dark:text-blue-400">B</span>
                    </div>
                    <div className="grid grid-cols-12 items-center">
                      <span className="col-span-6 text-slate-900 dark:text-white font-bold">Chloe Martin</span>
                      <span className="col-span-2 text-center text-slate-500 dark:text-slate-400">96</span>
                      <span className="col-span-2 text-center text-slate-500 dark:text-slate-400">99</span>
                      <span className="col-span-2 text-right font-black text-blue-600 dark:text-blue-400">A</span>
                    </div>
                    <div className="grid grid-cols-12 items-center">
                      <span className="col-span-6 text-slate-900 dark:text-white font-bold">Diego Reyes</span>
                      <span className="col-span-2 text-center text-slate-500 dark:text-slate-400">74</span>
                      <span className="col-span-2 text-center text-slate-500 dark:text-slate-400">79</span>
                      <span className="col-span-2 text-right font-black text-blue-600 dark:text-blue-400">C+</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <footer className="w-full max-w-7xl mx-auto text-center text-xs text-slate-400 dark:text-slate-600">
            © {new Date().getFullYear()} Gradewell Education Platform
          </footer>
        </div>
      )}

      {/* 2. BLACK CINEMASCOPE APERTURE TRANSITION (Triggers instantly after Gradewell disappears) */}
      {!showGradewell && (
        <>
          <motion.div
            initial={{ y: '0%' }}
            animate={{ y: isBlackOpening ? '-100%' : '0%' }}
            transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
            className="fixed top-0 inset-x-0 h-[50.5vh] bg-black z-50 shadow-2xl"
          />
          <motion.div
            initial={{ y: '0%' }}
            animate={{ y: isBlackOpening ? '100%' : '0%' }}
            transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
            className="fixed bottom-0 inset-x-0 h-[50.5vh] bg-black z-50 shadow-2xl"
          />
        </>
      )}
    </div>
  );
};
