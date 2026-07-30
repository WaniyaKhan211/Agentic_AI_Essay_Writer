from exa_py import Exa

from config import EXA_API_KEY

exa = Exa(api_key=EXA_API_KEY)


def search_web(query: str):
    """
    Search the web and return Exa results.
    """

    return exa.search(
        query,
        num_results=3,

    )