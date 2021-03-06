defmodule ChangelogWeb.NewsAdController do
  use ChangelogWeb, :controller

  alias Changelog.{Hashid, NewsAd}
  alias ChangelogWeb.NewsAdView

  def show(conn, %{"id" => slug}) do
    hashid = slug |> String.split("-") |> List.last
    ad = ad_from_hashid(hashid)

    if slug == hashid do
      redirect(conn, to: news_ad_path(conn, :show, NewsAdView.slug(ad)))
    else
      render(conn, :show, ad: ad, sponsor: ad.sponsorship.sponsor)
    end
  end

  def impress(conn, %{"ads" => hashids}) do
    hashids
    |> String.split(",")
    |> Enum.each(fn(hashid) ->
      hashid |> ad_from_hashid |> NewsAd.track_impression
    end)

    send_resp(conn, 200, "")
  end

  def visit(conn, %{"id" => hashid}) do
    ad = ad_from_hashid(hashid)
    NewsAd.track_click(ad)
    redirect(conn, external: ad.url)
  end

  defp ad_from_hashid(hashid) do
    NewsAd
    |> Repo.get_by!(id: Hashid.decode(hashid))
    |> NewsAd.preload_sponsorship
  end
end
