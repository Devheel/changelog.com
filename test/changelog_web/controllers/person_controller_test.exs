defmodule ChangelogWeb.PersonControllerTest do
  use ChangelogWeb.ConnCase
  use Bamboo.Test

  import Mock

  alias Changelog.Person

  describe "joining" do
    test "getting the form", %{conn: conn} do
      conn = get(conn, person_path(conn, :join))

      assert conn.status == 200
      assert conn.resp_body =~ "form"
    end

    @tag :as_user
    test "getting form when signed in is not allowed", %{conn: conn} do
      conn = get(conn, person_path(conn, :join))
      assert html_response(conn, 302)
      assert conn.halted
    end

    test "submission with missing data re-renders with errors", %{conn: conn} do
      count_before = count(Person)
      conn = post(conn, person_path(conn, :join), person: %{email: "nope"})
      assert html_response(conn, 200) =~ ~r/wrong/i
      assert count(Person) == count_before
    end

    test "submission with required data creates person, sends email, and redirects", %{conn: conn} do
      count_before = count(Person)

      conn = with_mock Craisin.Subscriber, [subscribe: fn(_, _, _) -> nil end] do
        post(conn, person_path(conn, :join), person: %{email: "joe@blow.com", name: "Joe Blow", handle: "joeblow"})
      end

      person = Repo.one(from p in Person, where: p.email == "joe@blow.com")
      assert_delivered_email ChangelogWeb.Email.community_welcome(person)
      assert redirected_to(conn) == root_path(conn, :index)
      assert count(Person) == count_before + 1
    end

    test "submission with existing email sends email, redirects, but doesn't create new person", %{conn: conn} do
      existing = insert(:person)
      count_before = count(Person)

      conn = with_mock Craisin.Subscriber, [subscribe: fn(_, _, _) -> nil end] do
        post(conn, person_path(conn, :join), person: %{email: existing.email, name: "Joe Blow", handle: "joeblow"})
      end

      existing = Repo.one(from p in Person, where: p.email == ^existing.email)

      assert_delivered_email ChangelogWeb.Email.community_welcome(existing)
      assert redirected_to(conn) == root_path(conn, :index)
      assert count(Person) == count_before
    end
  end

  describe "subscribing" do
    test "getting the form", %{conn: conn} do
      conn = get(conn, person_path(conn, :subscribe))

      assert conn.status == 200
      assert conn.resp_body =~ "form"
    end

    @tag :as_user
    test "getting form when signed in is not allowed", %{conn: conn} do
      conn = get(conn, person_path(conn, :subscribe))
      assert html_response(conn, 302)
      assert conn.halted
    end

    test "submission with required data creates person, sends email, and redirects", %{conn: conn} do
      count_before = count(Person)

      conn = with_mock Craisin.Subscriber, [subscribe: fn(_, _) -> nil end] do
        post(conn, person_path(conn, :subscribe), email: "joe@blow.com")
      end

      person = Repo.one(from p in Person, where: p.email == "joe@blow.com")
      assert_delivered_email ChangelogWeb.Email.subscriber_welcome(person)
      assert redirected_to(conn) == root_path(conn, :index)
      assert count(Person) == count_before + 1
    end

    test "submission with existing email sends email, redirects, but doesn't create person", %{conn: conn} do
      existing = insert(:person)
      count_before = count(Person)

      conn = with_mock Craisin.Subscriber, [subscribe: fn(_, _) -> nil end] do
        post(conn, person_path(conn, :subscribe), email: existing.email)
      end

      existing = Repo.one(from p in Person, where: p.email == ^existing.email)

      assert_delivered_email ChangelogWeb.Email.subscriber_welcome(existing)
      assert redirected_to(conn) == root_path(conn, :index)
      assert count(Person) == count_before
    end
  end
end
