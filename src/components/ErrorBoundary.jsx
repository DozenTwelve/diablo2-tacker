import { Component } from "react";
import { t } from "../lib/i18n";

// Keeps a rendering error from blanking the whole page: shows a message, with a way to clear the loaded saves
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { lang, onReset } = this.props;
    return (
      <div className="gothic-card space-y-3">
        <p>{t("pageError", lang)}</p>
        <p className="text-xs gothic-text-muted">{String(this.state.error.message ?? this.state.error)}</p>
        <button
          className="gothic-btn gothic-btn-secondary gothic-btn-small"
          onClick={() => {
            onReset();
            this.setState({ error: null });
          }}
        >
          {t("clear", lang)}
        </button>
      </div>
    );
  }
}
