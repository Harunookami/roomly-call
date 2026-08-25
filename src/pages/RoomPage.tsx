import { useParams } from 'react-router-dom'
import { Header } from '../components/Header/Header'

function RoomPage() {
    const { id } = useParams();


    return (
        <main className="min-h-screen bg-[#080d18] text-white p-6">

            <Header codigoSala='12312312'/>
        <p>conteudo aqui</p>
        </main>
    );
}

export default RoomPage;