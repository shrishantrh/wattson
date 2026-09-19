"""SEC blocks requests with no contact email in the User-Agent. If the env var
is missing we must stop, not guess an address."""

import pytest

from engine.ingest import edgar


def test_raises_and_names_the_env_var_when_it_is_unset(monkeypatch):
    monkeypatch.delenv("EDGAR_UA_EMAIL", raising=False)

    with pytest.raises(RuntimeError, match="EDGAR_UA_EMAIL"):
        edgar.user_agent()


def test_user_agent_identifies_the_project_and_the_contact(monkeypatch):
    monkeypatch.setenv("EDGAR_UA_EMAIL", "someone@example.edu")

    ua = edgar.user_agent()

    assert "someone@example.edu" in ua
    assert "Wattson" in ua


def test_cik_is_zero_padded_to_ten_digits():
    assert edgar.cik_for("META") == "0001326801"
    assert len(edgar.cik_for("MSFT")) == 10


def test_unknown_ticker_is_reported_not_guessed():
    with pytest.raises(KeyError):
        edgar.cik_for("NOPE")
