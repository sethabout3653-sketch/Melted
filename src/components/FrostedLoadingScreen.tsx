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
      {/* 1. SOLID GRADEWELL GRADEBOOK SCREEN (Instantly disappears after 1.5s, no fade out) */}
      {showGradewell && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#f8fafc] p-6 sm:p-12 pointer-events-auto">
          {/* Top Navigation */}
          <header className="w-full max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-md shadow-blue-600/20">
                  G
                </div>
                <span className="text-xl font-bold text-slate-900 tracking-tight font-heading">Gradewell</span>
              </div>
              <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
                <span>Gradebook</span>
                <span>Attendance</span>
                <span>Reports</span>
                <span>Pricing</span>
              </nav>
            </div>
            <div>
              <span className="text-sm font-semibold text-blue-600">Sign in</span>
            </div>
          </header>

          {/* Main Hero & Biology Card Section */}
          <main className="w-full max-w-7xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-8">
            {/* Left Column Text */}
            <div className="lg:col-span-6 space-y-6">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
                GRADEBOOK FOR TEACHERS
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] font-heading">
                Grading that keeps up with your classroom.
              </h1>
              <p className="text-base sm:text-lg text-slate-500 max-w-lg font-normal leading-relaxed">
                Track assignments, attendance and progress in one place, and share reports with students and families.
              </p>
              <div>
                <button
                  type="button"
                  className="px-6 py-3.5 bg-blue-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20"
                >
                  Start free trial
                </button>
              </div>
            </div>

            {/* Right Column Floating Card */}
            <div className="lg:col-span-6 flex justify-center lg:justify-end">
              <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100/80">
                <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                  <span className="font-bold text-slate-900 text-base">Period 3 · Biology</span>
                  <span className="text-xs font-medium text-slate-400">Fall term</span>
                </div>

                <div className="pt-4 space-y-4">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span className="col-span-6">STUDENT</span>
                    <span className="col-span-2 text-center">QUIZ</span>
                    <span className="col-span-2 text-center">LAB</span>
                    <span className="col-span-2 text-right">AVG</span>
                  </div>

                  {/* Student Rows */}
                  <div className="space-y-3.5 text-xs font-semibold text-slate-700">
                    <div className="grid grid-cols-12 items-center">
                      <span className="col-span-6 text-slate-900 font-bold">Amara Okafor</span>
                      <span className="col-span-2 text-center text-slate-500">92</span>
                      <span className="col-span-2 text-center text-slate-500">88</span>
                      <span className="col-span-2 text-right font-black text-blue-600">A-</span>
                    </div>
                    <div className="grid grid-cols-12 items-center">
                      <span className="col-span-6 text-slate-900 font-bold">Ben Hartley</span>
                      <span className="col-span-2 text-center text-slate-500">81</span>
                      <span className="col-span-2 text-center text-slate-500">85</span>
                      <span className="col-span-2 text-right font-black text-blue-600">B</span>
                    </div>
                    <div className="grid grid-cols-12 items-center">
                      <span className="col-span-6 text-slate-900 font-bold">Chloe Martin</span>
                      <span className="col-span-2 text-center text-slate-500">96</span>
                      <span className="col-span-2 text-center text-slate-500">99</span>
                      <span className="col-span-2 text-right font-black text-blue-600">A</span>
                    </div>
                    <div className="grid grid-cols-12 items-center">
                      <span className="col-span-6 text-slate-900 font-bold">Diego Reyes</span>
                      <span className="col-span-2 text-center text-slate-500">74</span>
                      <span className="col-span-2 text-center text-slate-500">79</span>
                      <span className="col-span-2 text-right font-black text-blue-600">C+</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <footer className="w-full max-w-7xl mx-auto text-center text-xs text-slate-400">
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
