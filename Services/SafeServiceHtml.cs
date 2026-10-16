using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

public static class SafeServiceHtml
{
    private static readonly HashSet<string> Tags = ["p", "br", "strong", "em", "ul", "ol", "li"];

    // Encode every text fragment and reconstruct only known tags, without attributes.
    public static string Sanitize(string? html)
    {
        if (string.IsNullOrEmpty(html)) return "";
        var result = new StringBuilder();
        var offset = 0;
        foreach (Match token in Regex.Matches(html, "<[^>]*>"))
        {
            result.Append(WebUtility.HtmlEncode(WebUtility.HtmlDecode(html[offset..token.Index])));
            var tag = Regex.Match(token.Value, @"^<\s*(/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>$");
            if (tag.Success && Tags.Contains(tag.Groups[2].Value.ToLowerInvariant()))
                result.Append('<').Append(tag.Groups[1].Value).Append(tag.Groups[2].Value.ToLowerInvariant()).Append('>');
            offset = token.Index + token.Length;
        }
        result.Append(WebUtility.HtmlEncode(WebUtility.HtmlDecode(html[offset..])));
        return result.ToString();
    }
}
