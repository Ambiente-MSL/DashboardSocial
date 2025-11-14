#!/usr/bin/env python3
"""
Utility script to reset (or create) DashboardSocial users with proper hashed passwords.

Usage examples:
  python scripts/update_user_password.py user@example.com "NovaSenhaSegura123"
  python scripts/update_user_password.py admin@example.com "Senha123" --role admin --nome "Nome" --create
"""
import argparse
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH, override=False)
else:
    load_dotenv(override=False)

from auth_utils import hash_password  # noqa: E402
from db import execute, fetch_one  # noqa: E402

APP_USERS_TABLE = os.getenv("APP_USERS_TABLE", "app_users")
DEFAULT_USER_ROLE = os.getenv("DEFAULT_USER_ROLE", "analista")


def _fetch_user_by_email(email: str):
    return fetch_one(
        f"""
        SELECT id, email, nome, role
        FROM {APP_USERS_TABLE}
        WHERE lower(email) = %(email)s
        """,
        {"email": email.strip().lower()},
    )


def _update_existing_user(user: dict, hashed_password: str, nome: Optional[str], role: Optional[str]):
    assignments = ["password_hash = %(password_hash)s", "updated_at = NOW()"]
    params = {
        "password_hash": hashed_password,
        "user_id": user["id"],
    }
    if nome:
        assignments.append("nome = %(nome)s")
        params["nome"] = nome
    if role:
        assignments.append("role = %(role)s")
        params["role"] = role

    execute(
        f"""
        UPDATE {APP_USERS_TABLE}
        SET {', '.join(assignments)}
        WHERE id = %(user_id)s
        """,
        params,
    )


def _create_user(email: str, hashed_password: str, nome: str, role: str):
    user_id = str(uuid.uuid4())
    execute(
        f"""
        INSERT INTO {APP_USERS_TABLE} (id, email, password_hash, role, nome)
        VALUES (%(id)s, %(email)s, %(password_hash)s, %(role)s, %(nome)s)
        """,
        {
            "id": user_id,
            "email": email,
            "password_hash": hashed_password,
            "role": role,
            "nome": nome,
        },
    )
    return user_id


def main():
    parser = argparse.ArgumentParser(description="Atualiza o hash de senha na tabela app_users.")
    parser.add_argument("email", help="E-mail do usuário que terá a senha redefinida.")
    parser.add_argument("password", help="Nova senha em texto plano (será convertida para hash).")
    parser.add_argument(
        "--nome",
        help="Atualiza o campo nome ao redefinir a senha (obrigatório ao usar --create).",
    )
    parser.add_argument(
        "--role",
        choices=["analista", "admin"],
        help="Atualiza o campo role ao redefinir a senha (opcional).",
    )
    parser.add_argument(
        "--create",
        action="store_true",
        help="Cria o usuário caso ele não exista (requer --nome).",
    )
    parser.add_argument(
        "--show-hash",
        action="store_true",
        help="Exibe o hash gerado para auditoria.",
    )
    args = parser.parse_args()

    email = args.email.strip().lower()
    if not email:
        parser.error("Informe um e-mail válido.")

    role = (args.role or DEFAULT_USER_ROLE or "analista").strip().lower()
    nome = args.nome.strip() if args.nome else None

    if args.create and not nome:
        parser.error("--create requer o argumento --nome.")

    hashed = hash_password(args.password)

    existing = _fetch_user_by_email(email)
    if existing:
        _update_existing_user(existing, hashed, nome, args.role)
        action = f"Senha atualizada para {existing['email']} (id={existing['id']})."
    elif args.create:
        user_id = _create_user(email, hashed, nome, role)
        action = f"Usuário criado com id={user_id} e role={role}."
    else:
        print(
            f"Nenhum usuário encontrado com e-mail {email}. Use --create para cadastrar um novo.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(action)
    if args.show_hash:
        print(f"Hash: {hashed}")


if __name__ == "__main__":
    main()
