import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-destructive/10 rounded-xl border border-destructive/20 text-center">
                    <h2 className="text-xl font-bold text-destructive mb-4">Something went wrong</h2>
                    <p className="text-sm text-muted-foreground mb-4 max-w-md">
                        The dashboard builder encountered an error.
                    </p>
                    <div className="bg-card p-4 rounded-lg border border-border mb-6 w-full max-w-lg overflow-auto max-h-[200px] text-left">
                        <code className="text-xs font-mono text-destructive">
                            {this.state.error?.message}
                        </code>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        Try Again
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
