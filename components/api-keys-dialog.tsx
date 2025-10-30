'use client';
import { useState, useEffect, useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';

export function ApiKeysDialog() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descId = useId();

  // Show dialog on first visit
  useEffect(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v);
  }, []);

  const handleGetStarted = () => {
    setOpen(false);
  };

  const handleViewDocs = () => {
    window.open('https://github.com/AlexCo888/nextjs-app-auditor', '_blank');
  };

  if (!mounted) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg mx-auto sm:max-w-[525px] sm:w-full" aria-labelledby={titleId} aria-describedby={descId}>
        <DialogHeader className="text-center px-2 sm:px-0">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-3 sm:mb-4">
            <svg className="w-5 h-5 sm:w-8 sm:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <DialogTitle id={titleId} className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Welcome to Next.js Audit App
          </DialogTitle>
          <DialogDescription id={descId} className="text-sm sm:text-base mt-1 sm:mt-2">
            An open-source AI-powered auditing tool for Next.js applications
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 px-2 sm:px-0">
          {/* Open Source Badge */}
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm font-medium text-green-800">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              100% Open Source
            </div>
          </div>

          {/* Main Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <h3 className="font-semibold text-blue-900 mb-1 sm:mb-2 text-sm sm:text-base">🔑 API Keys Required</h3>
            <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
              This is a self-hosted application that requires your own API keys to function. 
              You'll need to configure at least one AI provider to start auditing repositories.
            </p>
          </div>

          {/* Required API Keys */}
          <div className="space-y-2 sm:space-y-3">
            <h4 className="font-medium text-gray-900 text-sm sm:text-base">Required API Keys:</h4>
            
            <div className="space-y-2">
              <div className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-xs font-bold text-blue-600">1</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-gray-900 text-sm sm:text-base">AI Provider (Choose one)</h5>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                    <strong>Vercel AI Gateway:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">AI_GATEWAY_API_KEY</code>
                    <br className="hidden sm:block" />
                    <strong>or OpenAI:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">OPENAI_API_KEY</code>
                    <br className="hidden sm:block" />
                    <strong>or OpenRouter:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">OPENROUTER_API_KEY</code>
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-xs font-bold text-blue-600">2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-gray-900 text-sm sm:text-base">Database</h5>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">DATABASE_URL</code> (PostgreSQL)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-xs font-bold text-green-600">+</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-gray-900 text-sm sm:text-base">Optional</h5>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">GITHUB_TOKEN</code> for higher rate limits
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
            <h3 className="font-semibold text-amber-900 mb-1 sm:mb-2 text-sm sm:text-base">📝 Quick Setup</h3>
            <ol className="text-xs sm:text-sm text-amber-800 space-y-1 sm:space-y-1 list-decimal list-inside leading-relaxed">
              <li className="break-words">Copy <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">.env.example</code> to <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">.env.local</code></li>
              <li className="break-words">Add your API keys to the <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">.env.local</code> file</li>
              <li>Restart the development server</li>
            </ol>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
            <div className="text-center p-3 sm:p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h5 className="font-medium text-blue-900 text-xs sm:text-sm">Multi-Agent Analysis</h5>
            </div>
            
            <div className="text-center p-3 sm:p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h5 className="font-medium text-purple-900 text-xs sm:text-sm">AI-Powered</h5>
            </div>
            
            <div className="text-center p-3 sm:p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h5 className="font-medium text-green-900 text-xs sm:text-sm">Secure & Private</h5>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 px-2 sm:px-0">
          <Button 
            variant="ghost" 
            onClick={handleViewDocs}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            View Documentation
          </Button>
          <Button 
            onClick={handleGetStarted}
            className="w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
